import EventKit
import EventKitUI
import Foundation
import UIKit

@objc(DeviceCalendarModule)
class DeviceCalendarModule: NSObject, RCTBridgeModule, EKEventEditViewDelegate {
  static func moduleName() -> String! {
    "DeviceCalendarModule"
  }

  static func requiresMainQueueSetup() -> Bool {
    false
  }

  private let eventStore = EKEventStore()
  private var pendingEditorResolve: RCTPromiseResolveBlock?

  private func permissionStatusString() -> String {
    let status = EKEventStore.authorizationStatus(for: .event)

    if #available(iOS 17.0, *) {
      switch status {
      case .fullAccess:
        return "authorized"
      case .writeOnly:
        return "writeOnly"
      case .denied:
        return "denied"
      case .notDetermined:
        return "notDetermined"
      case .restricted:
        return "restricted"
      @unknown default:
        return "unknown"
      }
    }

    switch status {
    case .authorized:
      return "authorized"
    case .denied:
      return "denied"
    case .notDetermined:
      return "notDetermined"
    case .restricted:
      return "restricted"
    @unknown default:
      return "unknown"
    }
  }

  private func hasWriteAccess() -> Bool {
    let status = EKEventStore.authorizationStatus(for: .event)

    if #available(iOS 17.0, *) {
      return status == .fullAccess || status == .writeOnly
    }

    return status == .authorized
  }

  private func hasReadAccess() -> Bool {
    let status = EKEventStore.authorizationStatus(for: .event)

    if #available(iOS 17.0, *) {
      return status == .fullAccess
    }

    return status == .authorized
  }

  private func actionResult(status: String, eventId: String?) -> [String: Any] {
    [
      "status": status,
      "eventId": eventId ?? NSNull()
    ]
  }

  private func resolveCalendar(named calendarName: String) -> EKCalendar? {
    if calendarName.isEmpty {
      return eventStore.defaultCalendarForNewEvents
    }

    let calendars = eventStore.calendars(for: .event)
    if let calendar = calendars.first(where: { $0.title == calendarName }) {
      return calendar
    }

    let newCalendar = EKCalendar(for: .event, eventStore: eventStore)
    newCalendar.title = calendarName
    newCalendar.source = eventStore.defaultCalendarForNewEvents?.source

    do {
      try eventStore.saveCalendar(newCalendar, commit: true)
      return newCalendar
    } catch {
      return eventStore.defaultCalendarForNewEvents
    }
  }

  private func buildEvent(
    existingEvent: EKEvent?,
    title: String,
    startDate: Double,
    endDate: Double,
    location: String,
    notes: String,
    calendarName: String
  ) -> EKEvent {
    let event = existingEvent ?? EKEvent(eventStore: eventStore)
    event.title = title
    event.startDate = Date(timeIntervalSince1970: startDate)
    event.endDate = Date(timeIntervalSince1970: endDate)
    event.location = location
    event.notes = notes
    event.calendar = resolveCalendar(named: calendarName)
    return event
  }

  private func requireEvent(id eventId: String) throws -> EKEvent {
    guard let event = eventStore.event(withIdentifier: eventId) else {
      throw NSError(
        domain: "DeviceCalendarModule",
        code: 404,
        userInfo: [NSLocalizedDescriptionKey: "Event not found"]
      )
    }

    return event
  }

  private func serialize(event: EKEvent) -> [String: Any] {
    [
      "id": event.eventIdentifier,
      "title": event.title ?? "",
      "startDate": event.startDate.timeIntervalSince1970,
      "endDate": event.endDate.timeIntervalSince1970,
      "location": event.location ?? "",
      "notes": event.notes ?? "",
      "calendarName": event.calendar.title
    ]
  }

  @objc
  func checkPermissions(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(permissionStatusString())
  }

  @objc
  func requestPermissions(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 17.0, *) {
      eventStore.requestFullAccessToEvents { granted, error in
        if let error {
          reject(
            "PERMISSION_ERROR",
            "Failed to request calendar access: \(error.localizedDescription)",
            error
          )
        } else {
          resolve(granted)
        }
      }
    } else {
      eventStore.requestAccess(to: .event) { granted, error in
        if let error {
          reject(
            "PERMISSION_ERROR",
            "Failed to request calendar access: \(error.localizedDescription)",
            error
          )
        } else {
          resolve(granted)
        }
      }
    }
  }

  @objc
  func createEvent(
    _ title: String,
    startDate: Double,
    endDate: Double,
    location: String,
    notes: String,
    calendarName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard hasWriteAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }

    let event = buildEvent(
      existingEvent: nil,
      title: title,
      startDate: startDate,
      endDate: endDate,
      location: location,
      notes: notes,
      calendarName: calendarName
    )

    do {
      try eventStore.save(event, span: .thisEvent)
      resolve(actionResult(status: "saved", eventId: event.eventIdentifier))
    } catch {
      reject("SAVE_ERROR", "Failed to save event: \(error.localizedDescription)", error)
    }
  }

  @objc
  func updateEvent(
    _ eventId: String,
    title: String,
    startDate: Double,
    endDate: Double,
    location: String,
    notes: String,
    calendarName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard hasWriteAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }

    do {
      let existingEvent = try requireEvent(id: eventId)
      let event = buildEvent(
        existingEvent: existingEvent,
        title: title,
        startDate: startDate,
        endDate: endDate,
        location: location,
        notes: notes,
        calendarName: calendarName
      )

      try eventStore.save(event, span: .thisEvent)
      resolve(actionResult(status: "saved", eventId: event.eventIdentifier))
    } catch let error as NSError where error.code == 404 {
      reject("EVENT_NOT_FOUND", error.localizedDescription, error)
    } catch {
      reject("UPDATE_ERROR", "Failed to update event: \(error.localizedDescription)", error)
    }
  }

  @objc
  func openEventEditor(
    _ eventId: String,
    title: String,
    startDate: Double,
    endDate: Double,
    location: String,
    notes: String,
    calendarName: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard hasWriteAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }

    guard pendingEditorResolve == nil else {
      reject("CREATE_IN_PROGRESS", "Another openEventEditor request is already in progress", nil)
      return
    }

    do {
      let existingEvent = eventId.isEmpty ? nil : try requireEvent(id: eventId)
      let event = buildEvent(
        existingEvent: existingEvent,
        title: title,
        startDate: startDate,
        endDate: endDate,
        location: location,
        notes: notes,
        calendarName: calendarName
      )

      DispatchQueue.main.async {
        guard let rootViewController = Self.topViewController() else {
          reject("PRESENT_ERROR", "Unable to open the calendar editor", nil)
          return
        }

        let editor = EKEventEditViewController()
        editor.eventStore = self.eventStore
        editor.event = event
        editor.editViewDelegate = self

        self.pendingEditorResolve = resolve
        rootViewController.present(editor, animated: true)
      }
    } catch let error as NSError where error.code == 404 {
      reject("EVENT_NOT_FOUND", error.localizedDescription, error)
    } catch {
      reject("EDITOR_ERROR", "Failed to open event editor: \(error.localizedDescription)", error)
    }
  }

  @objc
  func getEvents(
    _ startDate: Double,
    endDate: Double,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard hasReadAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }

    let predicate = eventStore.predicateForEvents(
      withStart: Date(timeIntervalSince1970: startDate),
      end: Date(timeIntervalSince1970: endDate),
      calendars: nil
    )

    resolve(eventStore.events(matching: predicate).map(serialize))
  }

  @objc
  func findEventById(
    _ eventId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard hasReadAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }

    guard let event = eventStore.event(withIdentifier: eventId) else {
      resolve(nil)
      return
    }

    resolve(serialize(event: event))
  }

  @objc
  func deleteEvent(
    _ eventId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard hasWriteAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }

    guard let event = eventStore.event(withIdentifier: eventId) else {
      reject("EVENT_NOT_FOUND", "Event not found", nil)
      return
    }

    do {
      try eventStore.remove(event, span: .thisEvent)
      resolve(true)
    } catch {
      reject("DELETE_ERROR", "Failed to delete event: \(error.localizedDescription)", error)
    }
  }

  @objc
  func getCalendars(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard hasReadAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }

    let calendars = eventStore.calendars(for: .event).map { calendar in
      [
        "id": calendar.calendarIdentifier,
        "name": calendar.title,
        "type": calendar.type.rawValue,
        "allowsModifications": calendar.allowsContentModifications
      ] as [String: Any]
    }

    resolve(calendars)
  }

  func eventEditViewController(
    _ controller: EKEventEditViewController,
    didCompleteWith action: EKEventEditViewAction
  ) {
    let resolve = pendingEditorResolve
    pendingEditorResolve = nil

    controller.dismiss(animated: true) {
      switch action {
      case .saved:
        resolve?(self.actionResult(status: "saved", eventId: controller.event?.eventIdentifier))
      case .canceled:
        resolve?(self.actionResult(status: "cancelled", eventId: controller.event?.eventIdentifier))
      case .deleted:
        resolve?(self.actionResult(status: "cancelled", eventId: nil))
      @unknown default:
        resolve?(self.actionResult(status: "cancelled", eventId: nil))
      }
    }
  }

  private static func topViewController(
    controller: UIViewController? = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first(where: \.isKeyWindow)?
      .rootViewController
  ) -> UIViewController? {
    if let navigationController = controller as? UINavigationController {
      return topViewController(controller: navigationController.visibleViewController)
    }

    if let tabBarController = controller as? UITabBarController {
      return topViewController(controller: tabBarController.selectedViewController)
    }

    if let presentedViewController = controller?.presentedViewController {
      return topViewController(controller: presentedViewController)
    }

    return controller
  }
}

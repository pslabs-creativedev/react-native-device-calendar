import Foundation
import EventKit

@objc(DeviceCalendarModule)
class DeviceCalendarModule: NSObject, RCTBridgeModule {
  
  static func moduleName() -> String! {
    return "DeviceCalendarModule"
  }
  
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  private let eventStore = EKEventStore()

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
  
  @objc
  func checkPermissions(_ resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(permissionStatusString())
  }
  
  @objc
  func requestPermissions(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter reject: @escaping RCTPromiseRejectBlock) {
    if #available(iOS 17.0, *) {
      eventStore.requestFullAccessToEvents { granted, error in
        if let error = error {
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
        if let error = error {
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
  func createEvent(_ title: String,
                   startDate: Double,
                   endDate: Double,
                   location: String,
                   notes: String,
                   calendarName: String,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    let startDateObj = Date(timeIntervalSince1970: startDate)
    let endDateObj = Date(timeIntervalSince1970: endDate)
    
    guard hasWriteAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }
    
    let event = EKEvent(eventStore: eventStore)
    event.title = title
    event.startDate = startDateObj
    event.endDate = endDateObj
    event.location = location
    event.notes = notes
    
    // Find or create calendar
    if !calendarName.isEmpty {
      let calendars = eventStore.calendars(for: .event)
      if let calendar = calendars.first(where: { $0.title == calendarName }) {
        event.calendar = calendar
      } else {
        let newCalendar = EKCalendar(for: .event, eventStore: eventStore)
        newCalendar.title = calendarName
        newCalendar.source = eventStore.defaultCalendarForNewEvents?.source
        do {
          try eventStore.saveCalendar(newCalendar, commit: true)
          event.calendar = newCalendar
        } catch {
          event.calendar = eventStore.defaultCalendarForNewEvents
        }
      }
    } else {
      event.calendar = eventStore.defaultCalendarForNewEvents
    }
    
    do {
      try eventStore.save(event, span: .thisEvent)
      resolve(event.eventIdentifier)
    } catch {
      reject("SAVE_ERROR", "Failed to save event: \(error.localizedDescription)", error)
    }
  }
  
  @objc
  func getEvents(_ startDate: Double,
                 endDate: Double,
                 resolver resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    guard hasReadAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }
    
    let startDateObj = Date(timeIntervalSince1970: startDate)
    let endDateObj = Date(timeIntervalSince1970: endDate)
    
    let predicate = eventStore.predicateForEvents(withStart: startDateObj,
                                                    end: endDateObj,
                                                    calendars: nil)
    
    let events = eventStore.events(matching: predicate)
    let eventList = events.map { event -> [String: Any] in
      return [
        "id": event.eventIdentifier,
        "title": event.title ?? "",
        "startDate": event.startDate.timeIntervalSince1970,
        "endDate": event.endDate.timeIntervalSince1970,
        "location": event.location ?? "",
        "notes": event.notes ?? "",
        "calendarName": event.calendar.title
      ]
    }
    
    resolve(eventList)
  }
  
  @objc
  func deleteEvent(_ eventId: String,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    guard hasReadAccess() else {
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
      reject("DELETE_ERROR", "Failed to delete event", error)
    }
  }
  
  @objc
  func getCalendars(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard hasReadAccess() else {
      reject("PERMISSION_DENIED", "Calendar access not authorized", nil)
      return
    }
    
    let calendars = eventStore.calendars(for: .event)
    let calendarList = calendars.map { calendar -> [String: Any] in
      return [
        "id": calendar.calendarIdentifier,
        "name": calendar.title,
        "type": calendar.type.rawValue,
        "allowsModifications": calendar.allowsContentModifications
      ]
    }
    
    resolve(calendarList)
  }
}

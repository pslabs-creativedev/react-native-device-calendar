#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <EventKit/EventKit.h>

@interface RCT_EXTERN_MODULE(DeviceCalendarModule, NSObject)
RCT_EXTERN_METHOD(checkPermissions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(requestPermissions:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(createEvent:(NSString *)title
                  startDate:(double)startDate
                  endDate:(double)endDate
                  location:(NSString *)location
                  notes:(NSString *)notes
                  calendarName:(NSString *)calendarName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getEvents:(double)startDate
                  endDate:(double)endDate
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deleteEvent:(NSString *)eventId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getCalendars:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
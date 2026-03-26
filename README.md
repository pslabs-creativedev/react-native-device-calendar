# react-native-device-calendar

A React Native module for reading calendars and creating, listing, and deleting calendar events with native Android and iOS APIs.

## Installation

```sh
npm install react-native-device-calendar
```

For iOS:

```sh
cd ios && pod install
```

## Permissions

iOS apps must include a calendar usage description in `Info.plist`:

```xml
<key>NSCalendarsUsageDescription</key>
<string>This app needs calendar access to manage events.</string>
```

Android permissions are declared by the library, but your app still needs to request them at runtime.

## Usage

```ts
import {
  checkPermissions,
  requestPermissions,
  createEvent,
  getEvents,
  getCalendars,
  deleteEvent,
} from 'react-native-device-calendar';

const status = await checkPermissions();

if (status === 'notDetermined' || status === 'denied') {
  const granted = await requestPermissions();
  if (!granted) {
    throw new Error('Calendar permission was not granted');
  }
}

const calendars = await getCalendars();

const eventId = await createEvent({
  title: 'Project sync',
  startDate: new Date('2026-03-27T10:00:00'),
  endDate: new Date('2026-03-27T11:00:00'),
  location: 'Conference Room',
  notes: 'Sprint planning and blockers',
  calendarName: calendars[0]?.name,
});

const events = await getEvents({
  startDate: new Date('2026-03-01T00:00:00'),
  endDate: new Date('2026-03-31T23:59:59'),
});

await deleteEvent(eventId);
```

## API

### `checkPermissions()`

Returns one of:

- `authorized`
- `writeOnly`
- `denied`
- `notDetermined`
- `restricted`
- `unknown`

On iOS 17+, `writeOnly` means the app can create events but cannot read calendars or existing events.

### `requestPermissions()`

Requests calendar access and resolves to `true` when access is granted.

### `createEvent(params)`

Creates a new calendar event.

```ts
type CreateEventParams = {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  calendarName?: string;
};
```

### `getEvents(params)`

Returns events that overlap the provided date range.

```ts
type GetEventsParams = {
  startDate: Date;
  endDate: Date;
};
```

### `getCalendars()`

Returns the calendars available on the device.

### `deleteEvent(eventId)`

Deletes an event by native identifier.

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

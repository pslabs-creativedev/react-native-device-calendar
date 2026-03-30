# react-native-device-calendar

A React Native module for reading calendars, creating and updating events, finding events by ID, and opening native calendar editors with prefilled data on Android and iOS.

## Installation

```sh
npm install react-native-device-calendar
```

Then install iOS pods from your app project:

```sh
npx pod-install
```

## Permissions

iOS apps must include a calendar usage description in `Info.plist`:

```xml
<key>NSCalendarsUsageDescription</key>
<string>This app needs calendar access to manage events.</string>
```

Android permissions are declared by the library, but your app still needs to request them at runtime.

The library requests permission automatically before reading calendars, reading events, creating events, updating events, or opening the event editor.

## Usage

```ts
import {
  checkPermissions,
  createEvent,
  deleteEvent,
  findEventById,
  getCalendars,
  getEvents,
  openEventEditor,
  requestPermissions,
  updateEvent,
  type CalendarActionResult,
  type DeviceCalendarError,
} from 'react-native-device-calendar';

const status = await checkPermissions();

if (status === 'notDetermined' || status === 'denied') {
  const granted = await requestPermissions();
  if (!granted) {
    throw new Error('Calendar permission was not granted');
  }
}

const calendars = await getCalendars();

const created = await createEvent({
  title: 'Project sync',
  startDate: new Date('2026-03-27T10:00:00'),
  endDate: new Date('2026-03-27T11:00:00'),
  location: 'Conference Room',
  notes: 'Sprint planning and blockers',
  calendarName: calendars[0]?.name,
});

const updated = await updateEvent(created.eventId!, {
  title: 'Updated project sync',
  startDate: new Date('2026-03-27T10:30:00'),
  endDate: new Date('2026-03-27T11:30:00'),
  location: 'Conference Room B',
  notes: 'Updated agenda',
  calendarName: calendars[0]?.name,
});

const editorResult = await openEventEditor({
  eventId: updated.eventId!,
  title: 'Updated project sync',
  startDate: new Date('2026-03-27T10:30:00'),
  endDate: new Date('2026-03-27T11:30:00'),
  location: 'Conference Room B',
  notes: 'Updated agenda',
  calendarName: calendars[0]?.name,
});

const event = await findEventById(updated.eventId!);

const events = await getEvents({
  startDate: new Date('2026-03-01T00:00:00'),
  endDate: new Date('2026-03-31T23:59:59'),
});

await deleteEvent(updated.eventId!);
```

## Result Objects

Mutating APIs return a structured result:

```ts
type CalendarActionResult = {
  status: 'saved' | 'opened' | 'cancelled';
  eventId: string | number | null;
};
```

Behavior notes:

- `createEvent()` returns `{ status: 'saved', eventId }`
- `updateEvent()` returns `{ status: 'saved', eventId }`
- `openEventEditor()` returns `{ status: 'saved' | 'cancelled', eventId }` on iOS
- `openEventEditor()` returns `{ status: 'opened', eventId }` on Android because the calendar app is launched externally and does not reliably report save/cancel results back

## Typed Errors

All public APIs throw `DeviceCalendarError`:

```ts
type CalendarErrorCode =
  | 'PERMISSION_DENIED'
  | 'PERMISSION_ERROR'
  | 'CREATE_ERROR'
  | 'CREATE_IN_PROGRESS'
  | 'UPDATE_ERROR'
  | 'DELETE_ERROR'
  | 'QUERY_ERROR'
  | 'EVENT_NOT_FOUND'
  | 'EDITOR_ERROR'
  | 'PRESENT_ERROR'
  | 'ACTIVITY_UNAVAILABLE'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';
```

```ts
try {
  await createEvent(...);
} catch (error) {
  const calendarError = error as DeviceCalendarError;
  console.log(calendarError.code, calendarError.message);
}
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

### `requestPermissions()`

Requests calendar access and resolves to `true` when access is granted.

### `createEvent(params)`

Creates a new calendar event silently.

```ts
type EventInput = {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  calendarName?: string;
};
```

Returns `Promise<CalendarActionResult>`.

### `updateEvent(eventId, params)`

Updates an existing event silently.

Returns `Promise<CalendarActionResult>`.

### `openEventEditor(params)`

Opens the native event editor with prefilled data.

```ts
type OpenEventEditorParams = EventInput & {
  eventId?: string | number;
};
```

If `eventId` is provided, the editor opens that existing event for editing.

### `getEvents(params)`

Returns events overlapping the provided date range.

### `findEventById(eventId)`

Returns the matching event or `null`.

### `getCalendars()`

Returns the calendars available on the device.

### `deleteEvent(eventId)`

Deletes an event by native identifier.

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

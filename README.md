# react-native-device-calendar

A React Native calendar event module for reading calendars, creating and updating native calendar events, finding events by ID, deleting events, and opening native calendar editors with prefilled data on Android and iOS.

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

Access requirements:

- `getCalendars()`, `getEvents()`, and `findEventById()` require read access
- `createEvent()`, `updateEvent()`, `openEventEditor()`, and `deleteEvent()` require write access

On iOS 17+, `writeOnly` means the app can create or edit events but cannot read calendars or existing events.

## Validation

The library validates event input before calling the native APIs:

- `title` must not be empty
- `startDate` must be a valid `Date`
- `endDate` must be a valid `Date`
- `startDate` must be earlier than `endDate`

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

const createInEditor = await openEventEditor({
  title: 'New event from editor',
  startDate: new Date('2026-03-27T15:00:00'),
  endDate: new Date('2026-03-27T16:00:00'),
  notes: 'This opens the native calendar editor for creating a new event',
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

Platform note:

- On Android, `openEventEditor()` launches the calendar app and resolves as soon as the editor is opened
- On iOS, `openEventEditor()` resolves after the user saves or cancels the native editor
- On both platforms, passing `eventId` opens the editor for updating an existing native calendar event
- If `eventId` is omitted, `openEventEditor()` opens the editor for creating a new native calendar event

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
  await createEvent({
    title: '',
    startDate: new Date(),
    endDate: new Date(),
  });
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

Required params:

- `title`
- `startDate`
- `endDate`

Optional params:

- `location`
- `notes`
- `calendarName`

Returns `Promise<CalendarActionResult>`.

### `updateEvent(eventId, params)`

Updates an existing event silently.

Returns `Promise<CalendarActionResult>`.

### `openEventEditor(params)`

Opens the native calendar event editor with prefilled data.

```ts
type OpenEventEditorParams = EventInput & {
  eventId?: string | number;
};
```

Optional params:

- `eventId`
- `location`
- `notes`
- `calendarName`

If `eventId` is provided, the editor opens that existing native calendar event for editing. If `eventId` is omitted, the editor opens for creating a new event.

### `getEvents(params)`

Returns events overlapping the provided date range.

```ts
type GetEventsParams = {
  startDate: Date;
  endDate: Date;
};
```

Required params:

- `startDate`
- `endDate`

### `findEventById(eventId)`

Returns the matching event or `null`.

### `getCalendars()`

Returns the calendars available on the device.

### `deleteEvent(eventId)`

Deletes an event by native identifier.

Returns `Promise<boolean>`.

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

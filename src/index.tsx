import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-device-calendar' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n';

const DeviceCalendarModule = NativeModules.DeviceCalendarModule
  ? NativeModules.DeviceCalendarModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export interface CalendarEvent {
  id: string | number;
  title: string;
  startDate: number;
  endDate: number;
  location?: string;
  notes?: string;
  calendarName?: string;
}

export interface Calendar {
  id: string | number;
  name: string;
  type: number;
  allowsModifications?: boolean;
}

export interface EventInput {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  calendarName?: string;
}

export interface OpenEventEditorParams extends EventInput {
  eventId?: string | number;
}

export interface GetEventsParams {
  startDate: Date;
  endDate: Date;
}

export type PermissionStatus =
  | 'authorized'
  | 'writeOnly'
  | 'denied'
  | 'notDetermined'
  | 'restricted'
  | 'unknown';

export type CalendarActionStatus = 'saved' | 'opened' | 'cancelled';

export interface CalendarActionResult {
  status: CalendarActionStatus;
  eventId: string | number | null;
}

export type CalendarErrorCode =
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

export class DeviceCalendarError extends Error {
  code: CalendarErrorCode;
  cause?: unknown;

  constructor(code: CalendarErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'DeviceCalendarError';
    this.code = code;
    this.cause = cause;
  }
}

type PermissionAccess = 'read' | 'write';
type NativeActionResult = {
  status: CalendarActionStatus;
  eventId?: string | number | null;
};

const ANDROID_CALENDAR_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
  PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR,
] as const;

const hasWritePermission = (status: PermissionStatus) =>
  status === 'authorized' || status === 'writeOnly';

const hasReadPermission = (status: PermissionStatus) => status === 'authorized';

const normalizeError = (error: unknown): DeviceCalendarError => {
  if (error instanceof DeviceCalendarError) {
    return error;
  }

  const maybeNative = error as
    | {
        code?: string;
        message?: string;
      }
    | undefined;

  const code = (maybeNative?.code || 'UNKNOWN_ERROR') as CalendarErrorCode;
  const message = maybeNative?.message || 'Unknown calendar error';

  return new DeviceCalendarError(code, message, error);
};

const validateEventInput = (params: EventInput) => {
  if (!params.title.trim()) {
    throw new DeviceCalendarError(
      'VALIDATION_ERROR',
      'Event title is required.'
    );
  }

  if (
    Number.isNaN(params.startDate.getTime()) ||
    Number.isNaN(params.endDate.getTime())
  ) {
    throw new DeviceCalendarError(
      'VALIDATION_ERROR',
      'Valid startDate and endDate are required.'
    );
  }

  if (params.startDate.getTime() >= params.endDate.getTime()) {
    throw new DeviceCalendarError(
      'VALIDATION_ERROR',
      'startDate must be earlier than endDate.'
    );
  }
};

const getNativeEventArgs = (params: EventInput) =>
  [
    params.title,
    params.startDate.getTime() / 1000,
    params.endDate.getTime() / 1000,
    params.location || '',
    params.notes || '',
    params.calendarName || '',
  ] as const;

const normalizeActionResult = (
  result: NativeActionResult
): CalendarActionResult => ({
  status: result.status,
  eventId:
    result.eventId === undefined || result.eventId === null
      ? null
      : result.eventId,
});

const ensurePermission = async (
  access: PermissionAccess
): Promise<PermissionStatus> => {
  const initialStatus = await checkPermissions();
  const hasRequiredAccess =
    access === 'write'
      ? hasWritePermission(initialStatus)
      : hasReadPermission(initialStatus);

  if (hasRequiredAccess) {
    return initialStatus;
  }

  const granted = await requestPermissions();
  if (!granted) {
    throw new DeviceCalendarError(
      'PERMISSION_DENIED',
      access === 'write'
        ? 'Calendar write access is required before creating an event.'
        : 'Calendar access is required before reading calendar data.'
    );
  }

  const nextStatus = await checkPermissions();
  const hasNextAccess =
    access === 'write'
      ? hasWritePermission(nextStatus)
      : hasReadPermission(nextStatus);

  if (!hasNextAccess) {
    throw new DeviceCalendarError(
      'PERMISSION_DENIED',
      access === 'write'
        ? 'Calendar write access is required before creating an event.'
        : 'Calendar access is required before reading calendar data.'
    );
  }

  return nextStatus;
};

export const checkPermissions = async (): Promise<PermissionStatus> => {
  try {
    if (Platform.OS === 'android') {
      const androidHasReadPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALENDAR
      );
      const androidHasWritePermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR
      );

      if (androidHasReadPermission && androidHasWritePermission) {
        return 'authorized';
      }

      if (androidHasWritePermission) {
        return 'writeOnly';
      }

      return 'denied';
    }

    return (await DeviceCalendarModule.checkPermissions()) as PermissionStatus;
  } catch (error) {
    throw normalizeError(error);
  }
};

export const requestPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const results = await PermissionsAndroid.requestMultiple([
        ...ANDROID_CALENDAR_PERMISSIONS,
      ]);

      const androidHasReadPermission =
        results[PermissionsAndroid.PERMISSIONS.READ_CALENDAR] ===
        PermissionsAndroid.RESULTS.GRANTED;
      const androidHasWritePermission =
        results[PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR] ===
        PermissionsAndroid.RESULTS.GRANTED;

      const permanentlyDenied =
        results[PermissionsAndroid.PERMISSIONS.READ_CALENDAR] ===
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        results[PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR] ===
          PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

      if (permanentlyDenied) {
        throw new DeviceCalendarError(
          'PERMISSION_DENIED',
          'Calendar permission is permanently denied. Open app settings to enable Calendar access.'
        );
      }

      return androidHasReadPermission && androidHasWritePermission;
    }

    return (await DeviceCalendarModule.requestPermissions()) as boolean;
  } catch (error) {
    throw normalizeError(error);
  }
};

export const createEvent = async (
  params: EventInput
): Promise<CalendarActionResult> => {
  try {
    validateEventInput(params);
    await ensurePermission('write');
    const result = (await DeviceCalendarModule.createEvent(
      ...getNativeEventArgs(params)
    )) as NativeActionResult;
    return normalizeActionResult(result);
  } catch (error) {
    throw normalizeError(error);
  }
};

export const updateEvent = async (
  eventId: string | number,
  params: EventInput
): Promise<CalendarActionResult> => {
  try {
    validateEventInput(params);
    await ensurePermission('write');
    const result = (await DeviceCalendarModule.updateEvent(
      eventId.toString(),
      ...getNativeEventArgs(params)
    )) as NativeActionResult;
    return normalizeActionResult(result);
  } catch (error) {
    throw normalizeError(error);
  }
};

export const openEventEditor = async (
  params: OpenEventEditorParams
): Promise<CalendarActionResult> => {
  try {
    validateEventInput(params);
    await ensurePermission('write');
    const result = (await DeviceCalendarModule.openEventEditor(
      params.eventId?.toString() || '',
      ...getNativeEventArgs(params)
    )) as NativeActionResult;
    return normalizeActionResult(result);
  } catch (error) {
    throw normalizeError(error);
  }
};

export const getEvents = async (
  params: GetEventsParams
): Promise<CalendarEvent[]> => {
  try {
    await ensurePermission('read');
    const events = await DeviceCalendarModule.getEvents(
      params.startDate.getTime() / 1000,
      params.endDate.getTime() / 1000
    );
    return events as CalendarEvent[];
  } catch (error) {
    throw normalizeError(error);
  }
};

export const findEventById = async (
  eventId: string | number
): Promise<CalendarEvent | null> => {
  try {
    await ensurePermission('read');
    const event = await DeviceCalendarModule.findEventById(eventId.toString());
    return (event as CalendarEvent | null) ?? null;
  } catch (error) {
    throw normalizeError(error);
  }
};

export const deleteEvent = async (
  eventId: string | number
): Promise<boolean> => {
  try {
    await ensurePermission('write');
    return (await DeviceCalendarModule.deleteEvent(
      eventId.toString()
    )) as boolean;
  } catch (error) {
    throw normalizeError(error);
  }
};

export const getCalendars = async (): Promise<Calendar[]> => {
  try {
    await ensurePermission('read');
    return (await DeviceCalendarModule.getCalendars()) as Calendar[];
  } catch (error) {
    throw normalizeError(error);
  }
};

export default {
  checkPermissions,
  requestPermissions,
  createEvent,
  updateEvent,
  openEventEditor,
  getEvents,
  findEventById,
  deleteEvent,
  getCalendars,
  DeviceCalendarError,
};

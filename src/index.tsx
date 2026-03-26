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

// Type Definitions
export interface CalendarEvent {
  id: string | number;
  title: string;
  startDate: number; // Unix timestamp in seconds
  endDate: number; // Unix timestamp in seconds
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

export interface CreateEventParams {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  calendarName?: string;
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

type PermissionAccess = 'read' | 'write';
const ANDROID_CALENDAR_PERMISSIONS = [
  PermissionsAndroid.PERMISSIONS.READ_CALENDAR,
  PermissionsAndroid.PERMISSIONS.WRITE_CALENDAR,
] as const;
const hasWritePermission = (status: PermissionStatus) =>
  status === 'authorized' || status === 'writeOnly';

const hasReadPermission = (status: PermissionStatus) => status === 'authorized';

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
    throw new Error(
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
    throw new Error(
      access === 'write'
        ? 'Calendar write access is required before creating an event.'
        : 'Calendar access is required before reading calendar data.'
    );
  }

  return nextStatus;
};

/**
 * Check if the app has calendar permissions
 * @returns Permission status string
 * @example
 * const status = await checkPermissions();
 * if (status === 'authorized' || status === 'writeOnly') {
 *   // Has calendar access
 * }
 */
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

    const status = await DeviceCalendarModule.checkPermissions();
    return status as PermissionStatus;
  } catch (error) {
    console.error('Failed to check calendar permissions:', error);
    throw error;
  }
};

/**
 * Request calendar permissions from the user
 * @returns Boolean indicating if permission was granted
 * @example
 * const granted = await requestPermissions();
 * if (granted) {
 *   // Permission granted
 * }
 */
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
        throw new Error(
          'Calendar permission is permanently denied. Open app settings to enable Calendar access.'
        );
      }

      return androidHasReadPermission && androidHasWritePermission;
    }

    const granted = await DeviceCalendarModule.requestPermissions();
    return granted as boolean;
  } catch (error) {
    console.error('Failed to request calendar permissions:', error);
    throw error;
  }
};

/**
 * Create a new event in the device calendar
 * @param params - Event details
 * @returns Event ID
 * @example
 * const eventId = await createEvent({
 *   title: 'Meeting',
 *   startDate: new Date(),
 *   endDate: new Date(Date.now() + 3600000),
 *   location: 'Conference Room',
 *   notes: 'Discuss project',
 *   calendarName: 'Work'
 * });
 */
export const createEvent = async (
  params: CreateEventParams
): Promise<string | number> => {
  try {
    await ensurePermission('write');
    const eventId = await DeviceCalendarModule.createEvent(
      params.title,
      params.startDate.getTime() / 1000,
      params.endDate.getTime() / 1000,
      params.location || '',
      params.notes || '',
      params.calendarName || ''
    );
    return eventId;
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    throw error;
  }
};

/**
 * Get events from the device calendar within a date range
 * @param params - Date range
 * @returns Array of calendar events
 * @example
 * const events = await getEvents({
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-12-31')
 * });
 * events.forEach(event => {
 *   console.log(event.title, new Date(event.startDate * 1000));
 * });
 */
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
    console.error('Failed to get calendar events:', error);
    throw error;
  }
};

/**
 * Delete an event from the device calendar
 * @param eventId - ID of the event to delete
 * @returns Boolean indicating success
 * @example
 * const success = await deleteEvent('event123');
 * if (success) {
 *   console.log('Event deleted');
 * }
 */
export const deleteEvent = async (
  eventId: string | number
): Promise<boolean> => {
  try {
    await ensurePermission('read');
    const result = await DeviceCalendarModule.deleteEvent(eventId.toString());
    return result as boolean;
  } catch (error) {
    console.error('Failed to delete calendar event:', error);
    throw error;
  }
};

/**
 * Get all calendars on the device
 * @returns Array of calendars
 * @example
 * const calendars = await getCalendars();
 * calendars.forEach(calendar => {
 *   console.log(calendar.name, calendar.id);
 * });
 */
export const getCalendars = async (): Promise<Calendar[]> => {
  try {
    await ensurePermission('read');
    const calendars = await DeviceCalendarModule.getCalendars();
    return calendars as Calendar[];
  } catch (error) {
    console.error('Failed to get calendars:', error);
    throw error;
  }
};

// Default export for convenience
export default {
  checkPermissions,
  requestPermissions,
  createEvent,
  getEvents,
  deleteEvent,
  getCalendars,
};

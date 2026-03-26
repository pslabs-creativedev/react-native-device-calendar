import DeviceCalendar, {
  checkPermissions,
  createEvent,
  deleteEvent,
  getCalendars,
  getEvents,
  requestPermissions,
} from '../index';

describe('react-native-device-calendar exports', () => {
  it('exposes the expected public API', () => {
    expect(typeof checkPermissions).toBe('function');
    expect(typeof requestPermissions).toBe('function');
    expect(typeof createEvent).toBe('function');
    expect(typeof getEvents).toBe('function');
    expect(typeof deleteEvent).toBe('function');
    expect(typeof getCalendars).toBe('function');

    expect(DeviceCalendar).toMatchObject({
      checkPermissions,
      requestPermissions,
      createEvent,
      getEvents,
      deleteEvent,
      getCalendars,
    });
  });
});

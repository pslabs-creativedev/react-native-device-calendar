import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  checkPermissions,
  createEvent,
  getCalendars,
  getEvents,
  type Calendar,
  type CalendarEvent,
  type PermissionStatus,
} from 'react-native-device-calendar';

export default function App() {
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>('notDetermined');
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [message, setMessage] = useState('Checking calendar access...');
  const [creatingEvent, setCreatingEvent] = useState(false);

  useEffect(() => {
    const runInitialLoad = async () => {
      try {
        const status = await refreshPermissionStatus();
        await refreshCalendarData(status);

        if (status === 'authorized' || status === 'writeOnly') {
          setMessage(
            'Calendar access is ready. Tap "Create Example Event" to add an event.'
          );
          return;
        }

        setMessage(
          'Tap "Create Example Event" to trigger the calendar permission flow.'
        );
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : 'Unknown calendar error';
        setMessage(messageText);
      }
    };

    runInitialLoad().catch(() => {
      // Errors are already handled inside runInitialLoad.
    });
  }, []);

  const refreshPermissionStatus = async () => {
    const status = await checkPermissions();
    setPermissionStatus(status);
    return status;
  };

  const refreshCalendarData = async (status: PermissionStatus) => {
    if (status !== 'authorized') {
      setCalendars([]);
      setEvents([]);
      return;
    }

    const [availableCalendars, upcomingEvents] = await Promise.all([
      getCalendars(),
      getEvents({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    ]);

    setCalendars(availableCalendars);
    setEvents(upcomingEvents.slice(0, 5));
  };

  const handleCreateEvent = async () => {
    try {
      setCreatingEvent(true);
      const startDate = new Date(Date.now() + 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const eventId = await createEvent({
        title: 'Device calendar example event',
        startDate,
        endDate,
        notes: 'Created by the example app',
        location: 'Example calendar demo',
      });

      const status = await refreshPermissionStatus();
      await refreshCalendarData(status);
      setMessage(`Created example event successfully. Event ID: ${eventId}`);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown calendar error';
      setMessage(messageText);
    } finally {
      setCreatingEvent(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>react-native-device-calendar</Text>
      <Text style={styles.status}>Permission: {permissionStatus}</Text>
      <Text style={styles.message}>{message}</Text>

      <Pressable
        onPress={handleCreateEvent}
        style={({ pressed }) => [
          styles.button,
          pressed && !creatingEvent ? styles.buttonPressed : null,
          creatingEvent ? styles.buttonDisabled : null,
        ]}
        disabled={creatingEvent}
      >
        <Text style={styles.buttonText}>
          {creatingEvent ? 'Creating Event...' : 'Create Example Event'}
        </Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calendars</Text>
        <Text style={styles.sectionBody}>
          {calendars.length > 0
            ? calendars.map((calendar) => calendar.name).join(', ')
            : 'No calendars loaded'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Events</Text>
        <Text style={styles.sectionBody}>
          {events.length > 0
            ? events.map((event) => event.title).join(', ')
            : 'No events loaded'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 22,
  },
});

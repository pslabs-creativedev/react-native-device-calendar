import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  checkPermissions,
  createEvent,
  getCalendars,
  getEvents,
  requestPermissions,
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

  useEffect(() => {
    loadCalendarData();
  }, []);

  const loadCalendarData = async () => {
    try {
      const initialStatus = await checkPermissions();
      setPermissionStatus(initialStatus);

      let canReadCalendar = initialStatus === 'authorized';
      let canWriteCalendar =
        initialStatus === 'authorized' || initialStatus === 'writeOnly';

      if (initialStatus === 'notDetermined' || initialStatus === 'denied') {
        const granted = await requestPermissions();
        if (!granted) {
          setMessage('Calendar permission was denied.');
          return;
        }

        const nextStatus = await checkPermissions();
        setPermissionStatus(nextStatus);
        canReadCalendar = nextStatus === 'authorized';
        canWriteCalendar =
          nextStatus === 'authorized' || nextStatus === 'writeOnly';
      }

      if (canWriteCalendar) {
        await createEvent({
          title: 'Device calendar example event',
          startDate: new Date(Date.now() + 60 * 60 * 1000),
          endDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
          notes: 'Created by the example app',
        });
      }

      if (canReadCalendar) {
        const [availableCalendars, upcomingEvents] = await Promise.all([
          getCalendars(),
          getEvents({
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }),
        ]);

        setCalendars(availableCalendars);
        setEvents(upcomingEvents.slice(0, 5));
        setMessage('Calendar data loaded successfully.');
        return;
      }

      setMessage(
        'Write-only calendar access granted. Event creation works, but calendars and events cannot be read on this device.'
      );
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown calendar error';
      setMessage(messageText);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>react-native-device-calendar</Text>
      <Text style={styles.status}>Permission: {permissionStatus}</Text>
      <Text style={styles.message}>{message}</Text>

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

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  checkPermissions,
  createEvent,
  deleteEvent,
  findEventById,
  getCalendars,
  getEvents,
  openEventEditor,
  updateEvent,
  type Calendar,
  type CalendarActionResult,
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
  const [lastEventId, setLastEventId] = useState<string | number | null>(null);
  const [lastSavedEvent, setLastSavedEvent] = useState<CalendarEvent | null>(
    null
  );

  useEffect(() => {
    const runInitialLoad = async () => {
      try {
        const status = await refreshPermissionStatus();
        await refreshCalendarData(status);

        if (status === 'authorized' || status === 'writeOnly') {
          setMessage(
            'Calendar access is ready. You can save directly or open the native editor with prefilled event details.'
          );
          return;
        }

        setMessage(
          'Tap either event button to trigger the calendar permission flow.'
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
      setLastSavedEvent(null);
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

  const syncLastSavedEvent = async (eventId: string | number | null) => {
    setLastEventId(eventId);

    if (!eventId) {
      setLastSavedEvent(null);
      return null;
    }

    const event = await findEventById(eventId);
    setLastSavedEvent(event);
    return event;
  };

  const handleCreateEvent = async () => {
    try {
      setCreatingEvent(true);
      const startDate = new Date(Date.now() + 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const result = await createEvent({
        title: 'Device calendar example event',
        startDate,
        endDate,
        notes: 'Created by the example app',
        location: 'Example calendar demo',
      });

      const status = await refreshPermissionStatus();
      await refreshCalendarData(status);
      const savedEvent = await syncLastSavedEvent(result.eventId);
      setMessage(formatActionMessage('Silent save', result));
      if (savedEvent) {
        setMessage(
          `${formatActionMessage('Silent save', result)} Title: ${savedEvent.title}`
        );
      }
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown calendar error';
      setMessage(messageText);
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleOpenEventEditor = async () => {
    try {
      setCreatingEvent(true);
      const startDate = new Date(Date.now() + 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const result = await openEventEditor({
        eventId: lastEventId ?? undefined,
        title: 'Device calendar example event',
        startDate,
        endDate,
        notes: 'Created by the example app',
        location: 'Example calendar demo',
      });

      const status = await refreshPermissionStatus();
      await refreshCalendarData(status);
      const savedEvent = await syncLastSavedEvent(result.eventId);
      setMessage(
        savedEvent
          ? `${formatActionMessage('Editor flow', result)} Title: ${savedEvent.title}`
          : formatActionMessage('Editor flow', result)
      );
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown calendar error';
      setMessage(messageText);
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleUpdateLastEvent = async () => {
    if (!lastEventId) {
      setMessage(
        'Create or save an event first so there is something to update.'
      );
      return;
    }

    try {
      setCreatingEvent(true);
      const startDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const endDate = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const result = await updateEvent(lastEventId, {
        title: 'Updated example event',
        startDate,
        endDate,
        notes: 'Updated by the example app',
        location: 'Updated location',
      });

      const status = await refreshPermissionStatus();
      await refreshCalendarData(status);
      const refreshedEvent = await syncLastSavedEvent(result.eventId);
      setMessage(
        `${formatActionMessage('Update flow', result)} Latest title: ${
          refreshedEvent?.title ?? 'unknown'
        }`
      );
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown calendar error';
      setMessage(messageText);
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleDeleteLastEvent = async () => {
    if (!lastEventId) {
      setMessage(
        'Create or save an event first so there is something to delete.'
      );
      return;
    }

    try {
      setCreatingEvent(true);
      const deleted = await deleteEvent(lastEventId);
      const status = await refreshPermissionStatus();
      await refreshCalendarData(status);

      if (deleted) {
        await syncLastSavedEvent(null);
        setMessage('Deleted the last saved event successfully.');
        return;
      }

      setMessage('No event was deleted.');
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
          {creatingEvent ? 'Working...' : 'Create Event Silently'}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleUpdateLastEvent}
        style={({ pressed }) => [
          styles.button,
          styles.tertiaryButton,
          pressed && !creatingEvent ? styles.buttonPressed : null,
          creatingEvent ? styles.buttonDisabled : null,
        ]}
        disabled={creatingEvent}
      >
        <Text style={styles.buttonText}>
          {creatingEvent ? 'Working...' : 'Update Last Saved Event'}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleDeleteLastEvent}
        style={({ pressed }) => [
          styles.button,
          styles.deleteButton,
          pressed && !creatingEvent ? styles.buttonPressed : null,
          creatingEvent ? styles.buttonDisabled : null,
        ]}
        disabled={creatingEvent}
      >
        <Text style={styles.buttonText}>
          {creatingEvent ? 'Working...' : 'Delete Last Saved Event'}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleOpenEventEditor}
        style={({ pressed }) => [
          styles.button,
          styles.secondaryButton,
          pressed && !creatingEvent ? styles.buttonPressed : null,
          creatingEvent ? styles.buttonDisabled : null,
        ]}
        disabled={creatingEvent}
      >
        <Text style={styles.buttonText}>
          {creatingEvent ? 'Working...' : 'Open Prefilled Calendar Editor'}
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last Event ID</Text>
        <Text style={styles.sectionBody}>
          {lastEventId ?? 'No event saved yet'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last Saved Event</Text>
        <Text style={styles.sectionBody}>
          {lastSavedEvent
            ? `${lastSavedEvent.title} (${lastSavedEvent.id})`
            : 'No saved event in state'}
        </Text>
      </View>
    </ScrollView>
  );
}

const formatActionMessage = (label: string, result: CalendarActionResult) => {
  const eventIdText = result.eventId ? ` Event ID: ${result.eventId}` : '';
  return `${label} finished with status "${result.status}".${eventIdText}`;
};

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
  secondaryButton: {
    backgroundColor: '#1F2937',
  },
  tertiaryButton: {
    backgroundColor: '#374151',
  },
  deleteButton: {
    backgroundColor: '#991B1B',
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

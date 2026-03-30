package com.devicecalendar

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Intent
import android.database.Cursor
import android.os.Build
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.TimeZone
import android.content.pm.PackageManager

class DeviceCalendarModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DeviceCalendarModule"

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val status = when {
            hasCalendarReadPermission() && hasCalendarWritePermission() -> "authorized"
            hasCalendarWritePermission() -> "writeOnly"
            else -> "denied"
        }
        promise.resolve(status)
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        promise.resolve(hasCalendarReadPermission() && hasCalendarWritePermission())
    }

    @ReactMethod
    fun createEvent(
        title: String,
        startDate: Double,
        endDate: Double,
        location: String,
        notes: String,
        calendarName: String,
        promise: Promise
    ) {
        if (!hasCalendarWritePermission()) {
            rejectPermissionDenied(promise, "create an event")
            return
        }

        try {
            val values = buildEventValues(
                title = title,
                startDate = startDate,
                endDate = endDate,
                location = location,
                notes = notes,
                calendarName = calendarName
            )

            val uri = reactApplicationContext.contentResolver.insert(
                CalendarContract.Events.CONTENT_URI,
                values
            )

            if (uri == null) {
                promise.reject("CREATE_ERROR", "Failed to create event")
                return
            }

            val eventId = ContentUris.parseId(uri).toString()
            promise.resolve(actionResult("saved", eventId))
        } catch (e: Exception) {
            promise.reject("CREATE_ERROR", "Failed to create event: ${e.message}", e)
        }
    }

    @ReactMethod
    fun updateEvent(
        eventId: String,
        title: String,
        startDate: Double,
        endDate: Double,
        location: String,
        notes: String,
        calendarName: String,
        promise: Promise
    ) {
        if (!hasCalendarWritePermission()) {
            rejectPermissionDenied(promise, "update an event")
            return
        }

        try {
            val uri = ContentUris.withAppendedId(
                CalendarContract.Events.CONTENT_URI,
                eventId.toLong()
            )

            val rowsUpdated = reactApplicationContext.contentResolver.update(
                uri,
                buildEventValues(
                    title = title,
                    startDate = startDate,
                    endDate = endDate,
                    location = location,
                    notes = notes,
                    calendarName = calendarName
                ),
                null,
                null
            )

            if (rowsUpdated <= 0) {
                promise.reject("EVENT_NOT_FOUND", "Event not found")
                return
            }

            promise.resolve(actionResult("saved", eventId))
        } catch (e: Exception) {
            promise.reject("UPDATE_ERROR", "Failed to update event: ${e.message}", e)
        }
    }

    @ReactMethod
    fun openEventEditor(
        eventId: String,
        title: String,
        startDate: Double,
        endDate: Double,
        location: String,
        notes: String,
        calendarName: String,
        promise: Promise
    ) {
        if (!hasCalendarWritePermission()) {
            rejectPermissionDenied(promise, "open the calendar editor")
            return
        }

        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject(
                "ACTIVITY_UNAVAILABLE",
                "Unable to open the calendar editor without an active Activity"
            )
            return
        }

        try {
            val startMillis = (startDate * 1000).toLong()
            val endMillis = (endDate * 1000).toLong()

            val intent = if (eventId.isNotEmpty()) {
                Intent(Intent.ACTION_EDIT).apply {
                    data = ContentUris.withAppendedId(
                        CalendarContract.Events.CONTENT_URI,
                        eventId.toLong()
                    )
                }
            } else {
                Intent(Intent.ACTION_INSERT).apply {
                    data = CalendarContract.Events.CONTENT_URI
                }
            }

            intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startMillis)
            intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, endMillis)
            intent.putExtra(CalendarContract.Events.TITLE, title)
            intent.putExtra(CalendarContract.Events.DESCRIPTION, notes)
            intent.putExtra(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)

            if (location.isNotEmpty()) {
                intent.putExtra(CalendarContract.Events.EVENT_LOCATION, location)
            }

            if (calendarName.isNotEmpty()) {
                intent.putExtra(CalendarContract.Events.CALENDAR_ID, getCalendarId(calendarName))
            }

            activity.startActivity(intent)
            promise.resolve(actionResult("opened", if (eventId.isEmpty()) null else eventId))
        } catch (e: Exception) {
            promise.reject("EDITOR_ERROR", "Failed to open event editor: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getEvents(
        startDate: Double,
        endDate: Double,
        promise: Promise
    ) {
        if (!hasCalendarReadPermission()) {
            rejectPermissionDenied(promise, "read calendar events")
            return
        }

        try {
            val startMillis = (startDate * 1000).toLong()
            val endMillis = (endDate * 1000).toLong()

            val projection = eventProjection()
            val selection =
                "${CalendarContract.Events.DTEND} >= ? AND ${CalendarContract.Events.DTSTART} <= ?"
            val selectionArgs = arrayOf(startMillis.toString(), endMillis.toString())

            val cursor = reactApplicationContext.contentResolver.query(
                CalendarContract.Events.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                null
            )

            promise.resolve(readEvents(cursor))
        } catch (e: Exception) {
            promise.reject("QUERY_ERROR", "Failed to get events: ${e.message}", e)
        }
    }

    @ReactMethod
    fun findEventById(eventId: String, promise: Promise) {
        if (!hasCalendarReadPermission()) {
            rejectPermissionDenied(promise, "read calendar events")
            return
        }

        try {
            val cursor = reactApplicationContext.contentResolver.query(
                ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId.toLong()),
                eventProjection(),
                null,
                null,
                null
            )

            val events = readEvents(cursor)
            promise.resolve(
                if (events.size() > 0) {
                    events.getMap(0)
                } else {
                    null
                }
            )
        } catch (e: Exception) {
            promise.reject("QUERY_ERROR", "Failed to get event: ${e.message}", e)
        }
    }

    @ReactMethod
    fun deleteEvent(eventId: String, promise: Promise) {
        if (!hasCalendarWritePermission()) {
            rejectPermissionDenied(promise, "delete an event")
            return
        }

        try {
            val uri = ContentUris.withAppendedId(
                CalendarContract.Events.CONTENT_URI,
                eventId.toLong()
            )
            val rowsDeleted = reactApplicationContext.contentResolver.delete(uri, null, null)
            promise.resolve(rowsDeleted > 0)
        } catch (e: Exception) {
            promise.reject("DELETE_ERROR", "Failed to delete event: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getCalendars(promise: Promise) {
        if (!hasCalendarReadPermission()) {
            rejectPermissionDenied(promise, "read calendars")
            return
        }

        try {
            val projection = arrayOf(
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.NAME,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME
            )

            val cursor = reactApplicationContext.contentResolver.query(
                CalendarContract.Calendars.CONTENT_URI,
                projection,
                null,
                null,
                null
            )

            val calendars = mutableListOf<Map<String, Any>>()
            cursor?.use {
                while (it.moveToNext()) {
                    val id = it.getLong(it.getColumnIndexOrThrow(CalendarContract.Calendars._ID))
                    val name = it.getString(it.getColumnIndexOrThrow(CalendarContract.Calendars.NAME))
                    val displayName =
                        it.getString(
                            it.getColumnIndexOrThrow(
                                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME
                            )
                        )

                    calendars.add(
                        mapOf(
                            "id" to id.toString(),
                            "name" to (displayName ?: name),
                            "type" to 1
                        )
                    )
                }
            }

            promise.resolve(
                Arguments.makeNativeArray(calendars.map { Arguments.makeNativeMap(it) })
            )
        } catch (e: Exception) {
            promise.reject("QUERY_ERROR", "Failed to get calendars: ${e.message}", e)
        }
    }

    private fun actionResult(status: String, eventId: String?): WritableMap {
        return Arguments.createMap().apply {
            putString("status", status)
            if (eventId != null) {
                putString("eventId", eventId)
            } else {
                putNull("eventId")
            }
        }
    }

    private fun buildEventValues(
        title: String,
        startDate: Double,
        endDate: Double,
        location: String,
        notes: String,
        calendarName: String
    ): ContentValues {
        val values = ContentValues().apply {
            put(CalendarContract.Events.DTSTART, (startDate * 1000).toLong())
            put(CalendarContract.Events.DTEND, (endDate * 1000).toLong())
            put(CalendarContract.Events.TITLE, title)
            put(CalendarContract.Events.DESCRIPTION, notes)
            put(CalendarContract.Events.CALENDAR_ID, getCalendarId(calendarName))
            put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
            put(CalendarContract.Events.EVENT_LOCATION, location)
        }

        return values
    }

    private fun eventProjection(): Array<String> {
        return arrayOf(
            CalendarContract.Events._ID,
            CalendarContract.Events.TITLE,
            CalendarContract.Events.DTSTART,
            CalendarContract.Events.DTEND,
            CalendarContract.Events.EVENT_LOCATION,
            CalendarContract.Events.DESCRIPTION,
            CalendarContract.Events.CALENDAR_ID
        )
    }

    private fun readEvents(cursor: Cursor?): WritableArray {
        val events = mutableListOf<WritableMap>()

        cursor?.use {
            while (it.moveToNext()) {
                val calendarId =
                    it.getLong(it.getColumnIndexOrThrow(CalendarContract.Events.CALENDAR_ID))

                val event = Arguments.createMap().apply {
                    putString(
                        "id",
                        it.getLong(it.getColumnIndexOrThrow(CalendarContract.Events._ID)).toString()
                    )
                    putString(
                        "title",
                        it.getString(it.getColumnIndexOrThrow(CalendarContract.Events.TITLE)) ?: ""
                    )
                    putDouble(
                        "startDate",
                        it.getLong(it.getColumnIndexOrThrow(CalendarContract.Events.DTSTART)) / 1000.0
                    )
                    putDouble(
                        "endDate",
                        it.getLong(it.getColumnIndexOrThrow(CalendarContract.Events.DTEND)) / 1000.0
                    )
                    putString(
                        "location",
                        it.getString(
                            it.getColumnIndexOrThrow(CalendarContract.Events.EVENT_LOCATION)
                        ) ?: ""
                    )
                    putString(
                        "notes",
                        it.getString(it.getColumnIndexOrThrow(CalendarContract.Events.DESCRIPTION))
                            ?: ""
                    )
                    putString("calendarName", getCalendarNameById(calendarId))
                }

                events.add(event)
            }
        }

        return Arguments.makeNativeArray(events)
    }

    private fun rejectPermissionDenied(promise: Promise, action: String) {
        promise.reject("PERMISSION_DENIED", "Calendar permission is required to $action")
    }

    private fun hasCalendarReadPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true
        }

        return ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.READ_CALENDAR
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasCalendarWritePermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true
        }

        return ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.WRITE_CALENDAR
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun getCalendarId(calendarName: String): Long {
        return findCalendarId(calendarName, true)
            ?: findCalendarId(calendarName, false)
            ?: getDefaultCalendarId()
    }

    private fun getDefaultCalendarId(): Long {
        return findCalendarId("", true)
            ?: findCalendarId("", false)
            ?: throw Exception("No writable calendars found on device")
    }

    private fun findCalendarId(calendarName: String, visibleOnly: Boolean): Long? {
        val selectionParts = mutableListOf(
            "${CalendarContract.Calendars.SYNC_EVENTS} = 1",
            "${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= ${CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR}"
        )
        val selectionArgs = mutableListOf<String>()

        if (visibleOnly) {
            selectionParts.add("${CalendarContract.Calendars.VISIBLE} = 1")
        }

        if (calendarName.isNotEmpty()) {
            selectionParts.add(
                "(${CalendarContract.Calendars.NAME} = ? OR ${CalendarContract.Calendars.CALENDAR_DISPLAY_NAME} = ?)"
            )
            selectionArgs.add(calendarName)
            selectionArgs.add(calendarName)
        }

        val cursor = reactApplicationContext.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI,
            arrayOf(CalendarContract.Calendars._ID),
            selectionParts.joinToString(" AND "),
            if (selectionArgs.isEmpty()) null else selectionArgs.toTypedArray(),
            "${CalendarContract.Calendars._ID} ASC"
        )

        return cursor?.use {
            if (it.moveToFirst()) {
                it.getLong(it.getColumnIndexOrThrow(CalendarContract.Calendars._ID))
            } else {
                null
            }
        }
    }

    private fun getCalendarNameById(calendarId: Long): String {
        val cursor = reactApplicationContext.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI,
            arrayOf(CalendarContract.Calendars.NAME),
            "${CalendarContract.Calendars._ID} = ?",
            arrayOf(calendarId.toString()),
            null
        )

        return cursor?.use {
            if (it.moveToFirst()) {
                it.getString(it.getColumnIndexOrThrow(CalendarContract.Calendars.NAME)) ?: "Default"
            } else {
                "Default"
            }
        } ?: "Default"
    }
}

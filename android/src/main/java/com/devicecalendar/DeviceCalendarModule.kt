package com.devicecalendar

import android.content.ContentValues
import android.database.Cursor
import android.provider.CalendarContract
import android.content.ContentUris
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import java.util.TimeZone

class DeviceCalendarModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DeviceCalendarModule"

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val hasReadPermission = hasCalendarReadPermission()
        val hasWritePermission = hasCalendarWritePermission()
        val status = when {
            hasReadPermission && hasWritePermission -> "authorized"
            hasWritePermission -> "writeOnly"
            else -> "denied"
        }
        promise.resolve(status)
    }

    @ReactMethod
    fun requestPermissions(promise: Promise) {
        promise.resolve(hasCalendarWritePermission())
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
            promise.reject("PERMISSION_DENIED", "Calendar write permission not granted")
            return
        }

        try {
            val startMillis = (startDate * 1000).toLong()
            val endMillis = (endDate * 1000).toLong()

            val calendarId = getCalendarId(calendarName)
            
            val values = ContentValues().apply {
                put(CalendarContract.Events.DTSTART, startMillis)
                put(CalendarContract.Events.DTEND, endMillis)
                put(CalendarContract.Events.TITLE, title)
                put(CalendarContract.Events.DESCRIPTION, notes)
                put(CalendarContract.Events.CALENDAR_ID, calendarId)
                put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
                if (location.isNotEmpty()) {
                    put(CalendarContract.Events.EVENT_LOCATION, location)
                }
            }

            val uri = reactApplicationContext.contentResolver.insert(
                CalendarContract.Events.CONTENT_URI,
                values
            )

            if (uri == null) {
                promise.reject("CREATE_ERROR", "Failed to create event")
                return
            }

            val eventId = ContentUris.parseId(uri)
            promise.resolve(eventId)
        } catch (e: Exception) {
            promise.reject("CREATE_ERROR", "Failed to create event: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getEvents(
        startDate: Double,
        endDate: Double,
        promise: Promise
    ) {
        if (!hasCalendarReadPermission()) {
            promise.reject("PERMISSION_DENIED", "Calendar read permission not granted")
            return
        }

        try {
            val startMillis = (startDate * 1000).toLong()
            val endMillis = (endDate * 1000).toLong()

            val projection = arrayOf(
                CalendarContract.Events._ID,
                CalendarContract.Events.TITLE,
                CalendarContract.Events.DTSTART,
                CalendarContract.Events.DTEND,
                CalendarContract.Events.EVENT_LOCATION,
                CalendarContract.Events.DESCRIPTION,
                CalendarContract.Events.CALENDAR_ID
            )

            val selection = "${CalendarContract.Events.DTEND} >= ? AND ${CalendarContract.Events.DTSTART} <= ?"
            val selectionArgs = arrayOf(startMillis.toString(), endMillis.toString())

            val cursor: Cursor? = reactApplicationContext.contentResolver.query(
                CalendarContract.Events.CONTENT_URI,
                projection,
                selection,
                selectionArgs,
                null
            )

            val events = mutableListOf<Map<String, Any>>()
            cursor?.use {
                while (it.moveToNext()) {
                    val id = it.getLong(it.getColumnIndexOrThrow(CalendarContract.Events._ID))
                    val title = it.getString(it.getColumnIndexOrThrow(CalendarContract.Events.TITLE))
                    val eventStartDate = it.getLong(it.getColumnIndexOrThrow(CalendarContract.Events.DTSTART))
                    val eventEndDate = it.getLong(it.getColumnIndexOrThrow(CalendarContract.Events.DTEND))
                    val eventLocation = it.getString(it.getColumnIndexOrThrow(CalendarContract.Events.EVENT_LOCATION))
                    val description = it.getString(it.getColumnIndexOrThrow(CalendarContract.Events.DESCRIPTION))
                    val calendarId = it.getLong(it.getColumnIndexOrThrow(CalendarContract.Events.CALENDAR_ID))
                    
                    val calendarName = getCalendarNameById(calendarId)

                    events.add(mapOf(
                        "id" to id,
                        "title" to title,
                        "startDate" to eventStartDate / 1000.0,
                        "endDate" to eventEndDate / 1000.0,
                        "location" to (eventLocation ?: ""),
                        "notes" to (description ?: ""),
                        "calendarName" to calendarName
                    ))
                }
            }

            promise.resolve(Arguments.makeNativeArray(events.map { Arguments.makeNativeMap(it) }))
        } catch (e: Exception) {
            promise.reject("QUERY_ERROR", "Failed to get events: ${e.message}", e)
        }
    }

    @ReactMethod
    fun deleteEvent(eventId: String, promise: Promise) {
        if (!hasCalendarWritePermission()) {
            promise.reject("PERMISSION_DENIED", "Calendar write permission not granted")
            return
        }

        try {
            val uri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId.toLong())
            val rowsDeleted = reactApplicationContext.contentResolver.delete(uri, null, null)
            promise.resolve(rowsDeleted > 0)
        } catch (e: Exception) {
            promise.reject("DELETE_ERROR", "Failed to delete event: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getCalendars(promise: Promise) {
        if (!hasCalendarReadPermission()) {
            promise.reject("PERMISSION_DENIED", "Calendar read permission not granted")
            return
        }

        try {
            val projection = arrayOf(
                CalendarContract.Calendars._ID,
                CalendarContract.Calendars.NAME,
                CalendarContract.Calendars.CALENDAR_DISPLAY_NAME
            )

            val cursor: Cursor? = reactApplicationContext.contentResolver.query(
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
                    val displayName = it.getString(it.getColumnIndexOrThrow(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME))

                    calendars.add(mapOf(
                        "id" to id,
                        "name" to (displayName ?: name),
                        "type" to 1 // Simplified for Android
                    ))
                }
            }

            promise.resolve(Arguments.makeNativeArray(calendars.map { Arguments.makeNativeMap(it) }))
        } catch (e: Exception) {
            promise.reject("QUERY_ERROR", "Failed to get calendars: ${e.message}", e)
        }
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
        val projection = arrayOf(
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.NAME
        )
        
        val selection = if (calendarName.isNotEmpty()) {
            "${CalendarContract.Calendars.NAME} = ?"
        } else {
            null
        }
        
        val selectionArgs = if (calendarName.isNotEmpty()) {
            arrayOf(calendarName)
        } else {
            null
        }
        
        val cursor: Cursor? = reactApplicationContext.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            null
        )
        
        return cursor?.use {
            if (it.moveToFirst()) {
                it.getLong(it.getColumnIndexOrThrow(CalendarContract.Calendars._ID))
            } else {
                getDefaultCalendarId()
            }
        } ?: getDefaultCalendarId()
    }

    private fun getDefaultCalendarId(): Long {
        val projection = arrayOf(CalendarContract.Calendars._ID)
        val cursor: Cursor? = reactApplicationContext.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI,
            projection,
            null,
            null,
            null
        )
        
        return cursor?.use {
            if (it.moveToFirst()) {
                it.getLong(it.getColumnIndexOrThrow(CalendarContract.Calendars._ID))
            } else {
                throw Exception("No calendars found on device")
            }
        } ?: throw Exception("No calendars found on device")
    }

    private fun getCalendarNameById(calendarId: Long): String {
        val projection = arrayOf(CalendarContract.Calendars.NAME)
        val selection = "${CalendarContract.Calendars._ID} = ?"
        val selectionArgs = arrayOf(calendarId.toString())

        val cursor: Cursor? = reactApplicationContext.contentResolver.query(
            CalendarContract.Calendars.CONTENT_URI,
            projection,
            selection,
            selectionArgs,
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

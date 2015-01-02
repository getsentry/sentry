----
title:Rate Limits & Quotas
----

## Burst Quotas and Throttling

Sentry enforces rate limits using a 60-second counter. For example, when you send an event at 18:51 it will be counted only for the duration of that minute.

Most of the time when you're throttled, Sentry will return a 429. This error code means you've hit the 60 second burst protection. In rare cases, the server might flat out reject your request (connection refused). Both cases the throttling happens only for a short period of time (less than a minute), and the service will operate as expected once its lifted.

## Message Truncation

Sentry imposes hard limits on various components within a message. While the limits may change over time, and vary between attributes most individual attributes are capped at 512 bytes. Additionally, certain attributes also limit the maximum number of items.

For example, ``extra`` data is limited to 100 items, and each item is capped at 512 bytes. Similar restrictions apply to context locals (within a stacktrace's frame), as well as any similar attributes.

Generic attributes like the event's label also have limits, but are more flexible depending on their case. For example, the message attribute is limited to 1024 bytes.

The following limitations will be automatically enforced:

- Events greater than 100k are immediately dropped.
- Stacktrace's with large frame counts will be trimmed (the middle frames are dropped).
- Collections exceeding the max items will be trimmed down to the maximum size.
- Individually values exceeding the maximum length will be trimmed down to the maximum size.

## Optimizing What You Send

Trying to keep within the bounds of your subscription? Try these useful tips for optimizing what you send to Sentry:

- Only send information that you will act on. Generally these are errors, and sometimes warnings. You usually dont truly care about a user hitting a 404, or an action happening (such as you would see in DEBUG logging).
- Add some safety measures for system failures. If you frequently have to worry about your cache server going down, make it a soft failure, or make it only send to Sentry 10% of the time.

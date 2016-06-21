`sentry repair`
---------------

Attempt to repair any invalid data.

This by default will correct some common issues like projects missing
DSNs or counters desynchronizing.  Optionally it can also synchronize
the current client documentation from the Sentry documentation server
(--with-docs) and repair missing or broken callsigns and short IDs
(--with-callsigns).

Options
```````

- ``--with-docs / --without-docs``: Synchronize and repair embedded
  documentation. This is disabled by default.
- ``--with-callsigns / --without-callsigns``: Repair and fill callsigns.
  This is disabled by default.
- ``--help``: print this help page.

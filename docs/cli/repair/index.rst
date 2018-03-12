`sentry repair`
---------------

Attempt to repair any invalid data.

This by default will correct some common issues like projects missing
DSNs or counters desynchronizing.  Optionally it can also synchronize
the current client documentation from the Sentry documentation server
(--with-docs).

Options
```````

- ``--with-docs / --without-docs``: Synchronize and repair embedded
  documentation. This is disabled by default.
- ``--help``: print this help page.

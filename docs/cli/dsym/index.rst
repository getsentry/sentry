`sentry dsym`
-------------

Manage system symbols in Sentry.

This allows you to import and manage globally shared system symbols in
the Sentry installation.  In particular this is useful for iOS where
system symbols need to be ingested before stacktraces can be fully
symbolized due to device optimizations.

Options
```````

- ``--help``: print this help page.

Subcommands
```````````

.. toctree::
 :maxdepth: 1

 sdks <sdks/index>
 import-system-symbols <import-system-symbols/index>


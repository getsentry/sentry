`sentry devserver ADDRESS`
--------------------------

Starts a lightweight web server for development.

Options
```````

- ``--reload / --no-reload``: Autoreloading of python files.
- ``--watchers / --no-watchers``: Watch static files and recompile on
  changes.
- ``--workers / --no-workers``: Run asynchronous workers.
- ``--browser-reload / --no-browser-reload``: Automatic browser refreshing
  on webpack builds
- ``--styleguide / --no-styleguide``: Start local styleguide web server on
  port 9001
- ``--environment TEXT``: The environment name.
- ``-l, --loglevel [DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL]``: Global
  logging level. Use wisely.
- ``--logformat [human|machine]``: Log line format.
- ``--help``: print this help page.

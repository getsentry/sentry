`sentry run cron`
-----------------

Run periodic task dispatcher.

Options
```````

- ``--pidfile TEXT``: Optional file used to store the process pid. The
  program will not start if this file already exists and the pid is still
  alive.
- ``-f, --logfile TEXT``: Path to log file. If no logfile is specified,
  stderr is used.


- ``--autoreload``: Enable autoreloading.
- ``-l, --loglevel [DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL]``: Global
  logging level. Use wisely.
- ``--logformat [human|machine]``: Log line format.
- ``--help``: print this help page.

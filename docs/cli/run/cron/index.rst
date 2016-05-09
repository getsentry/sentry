`sentry run cron`
-----------------

Run periodic task dispatcher.

Options
```````

- ``--pidfile TEXT``: Optional file used to store the process pid. The
  program will not start if this file already exists and the pid is still
  alive.
- ``-l, --loglevel [DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL]``: Logging
  level.
- ``-f, --logfile TEXT``: Path to log file. If no logfile is specified,
  stderr is used.


- ``--autoreload``: Enable autoreloading.
- ``--help``: print this help page.

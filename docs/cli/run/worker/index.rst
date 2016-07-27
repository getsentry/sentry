`sentry run worker`
-------------------

Run background worker instance.

Options
```````

- ``-n, --hostname TEXT``: Set custom hostname, e.g. 'w1.%h'. Expands:
  %h(hostname), %n (name) and %d, (domain).
- ``-Q, --queues TEXT``: List of queues to enable for this worker,
  separated by comma. By default all configured queues are enabled.
  Example: -Q video,image

- ``-c, --concurrency INTEGER``: Number of child processes processing the
  queue. The default is the number of CPUs available on your system.
- ``-f, --logfile TEXT``: Path to log file. If no logfile is specified,
  stderr is used.


- ``--autoreload``: Enable autoreloading.
- ``-l, --loglevel [DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL]``: Global
  logging level. Use wisely.
- ``--logformat [human|machine]``: Log line format.
- ``--help``: print this help page.

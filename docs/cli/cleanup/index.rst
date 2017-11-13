`sentry cleanup`
----------------

Delete a portion of trailing data based on creation date.

All data that is older than `--days` will be deleted.  The default for
this is 30 days.  In the default setting all projects will be truncated
but if you have a specific project you want to limit this to this can be
done with the `--project` flag which accepts a project ID or a string
with the form `org/project` where both are slugs.

Options
```````

- ``--days INTEGER``: Numbers of days to truncate on.  [default: 30]
- ``--project TEXT``: Limit truncation to only entries from project.
- ``--concurrency INTEGER``: The total number of concurrent threads to run
  across processes.  [default: 1]
- ``--max_procs INTEGER``: The maximum number of processes to fork off for
  concurrency.  [default: 8]
- ``-q, --silent``: Run quietly. No output on success.

- ``-r, --router TEXT``: Database router
- ``-t, --timed``: Send the duration of this command to internal metrics.
- ``-l, --loglevel [DEBUG|INFO|WARNING|ERROR|CRITICAL|FATAL]``: Global
  logging level. Use wisely.
- ``--logformat [human|machine]``: Log line format.
- ``--help``: print this help page.

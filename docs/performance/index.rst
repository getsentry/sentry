Performance Tuning
==================

This document describes a set of best practices which may help you squeeze more performance out of various Sentry configurations.


Redis Configuration
-------------------

All Redis usage in Sentry is temporal, which means the append-log/fsync models in Redis do not need to apply.

- Disable saving by removing all ```save XXXX``` lines.
- Set ```maxclients 0``` to remove connection limitations.


Web Server Tuning via uWSGI
---------------------------

Switching off of the default Sentry worker model and to uWSGI + emporer mode can yield very good results.

If you're using supervisord, you can easily implement emporer mode and uWSGI yourself by doing something along the lines of:

```
[program:web]
command=newrelic-admin run-program /srv/www/getsentry.com/env/bin/uwsgi -s 127.0.0.1:90%(process_num)02d --log-x-forwarded-for --buffer-size 32768 --post-buffering 65536 --need-app --disable-logging --wsgi-file getsentry/wsgi.py --processes 1 --threads 6
process_name=%(program_name)s_%(process_num)02d
numprocs=20
numprocs_start=0
autostart=true
autorestart=true
startsecs=5
startretries=3
stopsignal=QUIT
stopwaitsecs=10
stopasgroup=true
killasgroup=true
environment=SENTRY_CONF="/srv/www/getsentry.com/current/getsentry/settings.py"
directory=/srv/www/getsentry.com/current/
```

See uWSGI's official documentation for emporer mode details.

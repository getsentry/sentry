Performance Tuning
==================

This document describes a set of best practices which may help you squeeze more performance out of various Sentry configurations.


Redis
-----

All Redis usage in Sentry is temporal, which means the append-log/fsync models in Redis do not need to apply.

With that in mind, we recommend the following changes to (some) default configurations:

- Disable saving by removing all ``save XXXX`` lines.
- Set ``maxclients 0`` to remove connection limitations.


Web Server
----------

Switching off of the default Sentry worker model and to uWSGI + emporer mode can yield very good results.

If you're using supervisord, you can easily implement emporer mode and uWSGI yourself by doing something along the lines of:

::

	[program:web]
	command=newrelic-admin run-program /srv/www/getsentry.com/env/bin/uwsgi -s 127.0.0.1:90%(process_num)02d --log-x-forwarded-for --buffer-size 32768 --post-buffering 65536 --need-app --disable-logging --wsgi-file getsentry/wsgi.py --processes 1 --threads 6
	process_name=%(program_name)s_%(process_num)02d
	numprocs=20
	numprocs_start=0
	startsecs=5
	startretries=3
	stopsignal=QUIT
	stopwaitsecs=10
	stopasgroup=true
	killasgroup=true
	environment=SENTRY_CONF="/srv/www/getsentry.com/current/getsentry/settings.py"
	directory=/srv/www/getsentry.com/current/

Once you're running multiple processes, you'll of course need to also configure something like Nginx to load balance to them:

::

	upstream internal {
	  least_conn;
	  server 127.0.0.1:9000;
	  server 127.0.0.1:9001;
	  server 127.0.0.1:9002;
	  server 127.0.0.1:9003;
	  server 127.0.0.1:9004;
	  server 127.0.0.1:9005;
	  server 127.0.0.1:9006;
	  server 127.0.0.1:9007;
	  server 127.0.0.1:9008;
	  server 127.0.0.1:9009;
	  server 127.0.0.1:9010;
	  server 127.0.0.1:9011;
	  server 127.0.0.1:9012;
	  server 127.0.0.1:9013;
	  server 127.0.0.1:9014;
	  server 127.0.0.1:9015;
	  server 127.0.0.1:9016;
	  server 127.0.0.1:9017;
	  server 127.0.0.1:9018;
	  server 127.0.0.1:9019;
	}

	server {
	  listen   80;

	  server_name     sentry.example.com;

	  location / {
	    uwsgi_pass    internal;

	    uwsgi_param   Host                 $host;
	    uwsgi_param   X-Real-IP            $remote_addr;
	    uwsgi_param   X-Forwarded-For      $proxy_add_x_forwarded_for;
	    uwsgi_param   X-Forwarded-Proto    $http_x_forwarded_proto;

	    include uwsgi_params;
	  }
	}

See uWSGI's official documentation for emporer mode details.


Celery
------

Celery can be difficult to tune. Your goal is to maximize the CPU usage without running out of memory. If you have JavaScript clients this becomes more difficult, as currently the sourcemap and context scraping can buffer large amounts of memory depending on your configurations and the size of your source files.

On a completely anecdotal note, you can take the same approach that you might take with improving the webserver: spam more processes. We again look to supervisord for managing this for us:

::

	[program:celeryd]
	command=/srv/www/getsentry.com/env/bin/sentry celery worker -c 6 -P processes -l WARNING -n worker-%(process_num)02d.worker-3
	process_name=%(program_name)s_%(process_num)02d
	numprocs=16
	numprocs_start=0
	startsecs=1
	startretries=3
	stopsignal=TERM
	stopwaitsecs=10
	stopasgroup=false
	killasgroup=true
	environment=SENTRY_CONF="/srv/www/getsentry.com/current/getsentry/settings.py"
	directory=/srv/www/getsentry.com/current/



Monitoring Memory
-----------------

There are cases where Sentry currently buffers large amounts of memory. This may depend on the client (javascript vs python) as well as the size of your events. If you repeatedly run into issues where workers or web nodes are using a lot of memory, you'll want to ensure you have some mechanisms for monitoring and resolving this.

If you're using supervisord, we recommend taking a look at `superlance <http://superlance.readthedocs.org>`_ which aids in this situation:

::

	[eventlistener:memmon]
	command=memmon -a 400MB -m ops@example.com
	events=TICK_60

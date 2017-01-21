Performance Tuning
==================

This document describes a set of best practices which may help you squeeze
more performance out of various Sentry configurations.


Redis
-----

All Redis usage in Sentry is temporal, which means the append-log/fsync
models in Redis do not need to apply.

With that in mind, we recommend the following changes to (some) default
configurations:

- Disable saving by removing all ``save XXXX`` lines.
- Set ``maxmemory-policy allkeys-lru`` to aggressively prune all keys.
- Set ``maxmemory 1gb`` to a reasonable allowance.


.. _performance-web-server:

Web Server
----------

Switching Sentry to run in uwsgi mode as opposed to http is a way to yield
some better results. uwsgi protocol is a binary protocol that Nginx can
speak using the `ngx_http_uwsgi_module <http://nginx.org/en/docs/http/ngx_http_uwsgi_module.html>`_.

This can be enabled by adding to your ``SENTRY_WEB_OPTIONS`` inside
``sentry.conf.py``::

	SENTRY_WEB_OPTIONS = {
	    'protocol': 'uwsgi',
	}

.. Note:: When in uwsgi mode, it's not possible to access directly from
          a web browser or tools like curl since it no longer speaks HTTP.

With Sentry running in uwsgi protocol mode, it'll require a slight
modification to your nginx config to use ``uwsgi_pass`` rather than
``proxy_pass``::

	server {
	  listen   443 ssl;

	  location / {
	    include     uwsgi_params;
	    uwsgi_pass  127.0.0.1:9000;
	  }
	}


You also will likely want to run more web processes, which will spawn as
children of the Sentry master process. The default number of workers is
``3``. It's possible to bump this up to ``36`` or more depending on how
many cores you have on the machine. You can do this either by editing
``SENTRY_WEB_OPTIONS`` again::

	SENTRY_WEB_OPTIONS = {
	    'workers': 16,
	}

or can be passed through the command line as::

	$ sentry run web -w 16

See `uWSGI's official documentation <https://uwsgi-docs.readthedocs.io/en/latest/Options.html>`_
for more options that can be configured in ``SENTRY_WEB_OPTIONS``.


Workers
-------

The workers can be difficult to tune. Your goal is to maximize the CPU usage
without running out of memory. If you have JavaScript clients this becomes
more difficult, as currently the sourcemap and context scraping can buffer
large amounts of memory depending on your configurations and the size of
your source files.

We can leverage supervisord to do this for us::

	[program:worker]
	command=/www/sentry/bin/sentry run worker -c 4 -l WARNING -n worker-%(process_num)02d
	process_name=%(program_name)s_%(process_num)02d
	numprocs=16
	numprocs_start=0
	startsecs=1
	startretries=3
	stopsignal=TERM
	stopwaitsecs=10
	stopasgroup=false
	killasgroup=true
	environment=SENTRY_CONF="/etc/sentry"
	directory=/www/sentry/

If you're running a worker configuration with a high concurrency
level (> 4) we suggest decreasing it and running more masters as
this will alleviate lock contention and improve overall throughput.

e.g. if you had something like:

::

    numprocs=1
    command=sentry run worker -c 64

change it to:

::

    numprocs=16
    command=sentry run worker -c 4


Monitoring Memory
-----------------

There are cases where Sentry currently buffers large amounts of memory.
This may depend on the client (javascript vs python) as well as the size
of your events. If you repeatedly run into issues where workers or web
nodes are using a lot of memory, you'll want to ensure you have some
mechanisms for monitoring and resolving this.

If you're using supervisord, we recommend taking a look at `superlance
<https://superlance.readthedocs.io>`_ which aids in this situation::

	[eventlistener:memmon]
	command=memmon -a 400MB -m ops@example.com
	events=TICK_60

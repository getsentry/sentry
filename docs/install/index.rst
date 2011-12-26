Install
=======

If you haven't already, start by downloading Sentry. The easiest way is with *pip*::

	pip install django-sentry --upgrade

Or with *setuptools*::

	easy_install -U django-sentry

You now have two choices:

1. Run an integrated setup where your webapp runs both the Sentry client and server.

   If you run on a single web server, or don't expect high load, this is the quickest
   configuration to get up and running.

2. (Recommended) Runs the server in a separate web instance to isolate your application.

   The recommended setup for apps which have any kind of quality of service requirements.
   Your Sentry server (web) application will run in its own environment which ensures the
   most compatibility with your application, as well as ensuring it does not impact your
   primary application servers.

Integrating with an existing Django install
-------------------------------------------

The integrated setup is the easiest to get up and running. It simply requires you to plug the Sentry application into your existing
Django project. Once installed, you simply need to update your settings.py and add ``sentry`` and ``raven.contrib.django`` to ``INSTALLED_APPS``::

	INSTALLED_APPS = (
	    'django.contrib.admin',
	    'django.contrib.auth',
	    'django.contrib.contenttypes',
	    'django.contrib.sessions',

	    'sentry',
	    'raven.contrib.django',
	    ...
	)

.. note:: Raven is a seperate project, and the official Python client for Sentry.

You will also need to add ``sentry.web.urls`` to your url patterns::

	urlpatterns = patterns('',
	    (r'^sentry/', include('sentry.web.urls')),
	)

We also highly recommend setting ``TEMPLATE_DEBUG=True`` in your environment (not to be confused with ``DEBUG``). This will allow
Sentry to receive template debug information when it hits a syntax error.

Finally, run ``python manage.py syncdb`` to create the database tables.

.. note::

   We recommend using South for migrations. Initial migrations have already been created for Sentry in sentry/migrations/ so you only need to run ``python manage.py migrate sentry`` instead of ``syncdb``

.. seealso::

   See :doc:`../technical/index` for information on additional plugins and functionality included.

Upgrading
~~~~~~~~~

Upgrading Sentry is fairly painless with South migrations. If you're not using South then you're on your own::

	python manage.py migrate sentry

Running a Sentry Server
-----------------------

The recommended configuration of Sentry involves setting up a separate web server to handle your error
logging. This means that any number of Sentry clients simply pass on this information to your primary Sentry
server. If you run into a situation where one of Sentry's requirements conflict with your own, or you simply
need to ensure quality of service within your project, this is for you.

The Built-in Server
~~~~~~~~~~~~~~~~~~~

Sentry provides a built-in webserver (powered by eventlet) to get you off the ground quickly. It's powered by two open source
libraries, eventlet and python-daemon. To get started, you will need to manually install those dependicies::

	easy_install eventlet>=0.9.15
	easy_install python-daemon>=1.6

Sentry provides the start, stop, and restart commands available via the command line interface to manage the server process::

	# Sentry's server runs on port 9000 by default. Make sure your ``SENTRY_SERVERS`` settings reflects
	# the correct host and port!
	sentry start --config=/etc/sentry.conf.py

.. note::

   The ``start`` command will also automatically run the ``upgrade`` command, which handles data and schema migrations.

The configuration for the server is based on ``sentry.conf.server``, which contains a basic Django project configuration, as well
as the default Sentry configuration values. It will use SQLite for the database, and Haystack using Whoosh. If you specify your own
configuration via --config, you will likely want to preface the file with importing the global defaults::

    #!/usr/bin/env python
    # filename: /etc/sentry.conf.py

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql_psycopg2',
            'NAME': 'sentry',
            'USER': 'postgres',
            'PASSWORD': '',
            'HOST': '',
            'PORT': '',
        }
    }

    SENTRY_LOG_FILE = '/var/log/sentry.log'
    SENTRY_WEB_HOST = '0.0.0.0'
    SENTRY_WEB_PORT = 9000

By default, Sentry will also look for ``~/.sentry/sentry.conf.py`` and load it if it exists, and ``--config`` is not passed.

.. note::

   The default database is SQLite, which generally does not perform very well.

The following settings are available for the built-in webserver:

WEB_HOST
````````

The hostname which the webserver should bind to. Defaults to ``localhost``.

WEB_PORT
````````
The port which the webserver should listen on. Defaults to ``9000``.

WEB_PID_FILE
````````````

The location to store the PID file. Defaults to ``/var/run/sentry.pid``.

WEB_LOG_FILE
````````````

The location to store the log file. Defaults to ``/var/log/sentry.log``.

Configuring a Sentry WSGI app
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you need more flexibility in your Sentry server, you may want to setup the server project manually. While this guide does not
cover configuring your webserver, it does describe the required attributes of your WSGI app to run in a standalone server mode.

First you're going to need to add Sentry to your server's INSTALLED_APPS::

	INSTALLED_APPS = [
	  ...
	  'sentry',
	  # We recommend adding the client to capture errors
	  # seen on this server as well
	  'raven.contrib.django',
	]

You will also need to ensure that your ``SENTRY_KEY`` matches across your client and server configurations::

	SENTRY_KEY = '0123456789abcde'


Configure your Clients
~~~~~~~~~~~~~~~~~~~~~~

On each of your application servers, you will need to configure Sentry to communicate with your remote Sentry server.

Start with adding the client to your ``INSTALLED_APPS``::

	INSTALLED_APPS = [
	  ...
	  'raven.contrib.django',
	]

Add the ``SENTRY_SERVERS`` configuration variable, to point to the absolute location to the ``/store/`` view on your
Sentry server::

	# This should be the absolute URI of sentries store view
	SENTRY_SERVERS = ['http://your.sentry.server/sentry/store/']

You will also need to ensure that your ``SENTRY_KEY`` matches across your client and server configurations::

	SENTRY_KEY = '0123456789abcde'

Install
=======

Sentry requires at least Django 1.2 (it will generally take care of this by itself),
and Python 2.5. Currently Sentry does not work with Python 3.

If you haven't already, start by downloading Sentry. The easiest way is with *pip*::

	pip install sentry --upgrade

Or with *setuptools*::

	easy_install -U sentry

You now have two choices:

1. **(Recommended)** Run the server in a separate web instance to isolate your application.

   The recommended setup for apps which have any kind of quality of service requirements.
   Your Sentry server (web) application will run in its own environment which ensures the
   most compatibility with your application, as well as ensuring it does not impact your
   primary application servers.

2. Run an integrated setup where your webapp runs both the Sentry client and server.

   If you run on a single web server, or don't expect high load, this is the quickest
   configuration to get up and running.

Upgrading
---------

**Always upgrade the Sentry server before upgrading your clients** unless
the client states otherwise.

Upgrading Sentry simply requires you to run migrations and restart your web services. We recommend
you run the migrations from a separate install so that they can be completed before updating the
code which runs the webserver.

To run the migrations, simply run ``sentry upgrade`` in your environment.

Upgrading from 1.x
~~~~~~~~~~~~~~~~~~

If you are upgrading Sentry from a 1.x version, you should take note that the database migrations
are much more significant than they were in the past. We recommend performing them **before**
upgrading the actual Sentry server.

This includes several new tables (such as Project), and alters on almost all existing tables. It
also means it needs to backfill the project_id column on all related tables.

You should also read over the installation guide again, as some things have likely changed.

Running a Sentry Server
-----------------------

The recommended configuration of Sentry involves setting up a separate web server to handle your error
logging. This means that any number of Sentry clients simply pass on this information to your primary Sentry
server. If you run into a situation where one of Sentry's requirements conflict with your own, or you simply
need to ensure quality of service within your project, this is for you.

.. note:: Currently the standalone Sentry server does not run on Windows.

Initializing the Configuration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The first thing you're going to need to do is initialize your configuration (likely because you'll want to switch
off of sqlite, which is the default database).

To do this, you'll use the "init" command. You can specify an alternative configuration
path as the argument to init, otherwise it will use the default of ``~/.sentry/sentry.conf.py``.

::

    # the path is optional
    sentry init /etc/sentry.conf.py

The Built-in Server
~~~~~~~~~~~~~~~~~~~

Sentry provides a built-in webserver (powered by eventlet) to get you off the ground quickly.

The CLI runner has three commands for controlling processes: start, stop, and restart. For example,
to start the HTTP server, you can simply use "sentry start"::

	# Sentry's server runs on port 9000 by default. Make sure your ``SENTRY_SERVERS`` settings reflects
	# the correct host and port!
	sentry start --config=/etc/sentry.conf.py

The configuration for the server is based on ``sentry.conf.server``, which contains a basic Django project configuration, as well
as the default Sentry configuration values. It will use SQLite for the database.::

    # ~/.sentry/sentry.conf.py

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
    SENTRY_KEY = '0123456789abcde'

By default, Sentry will look for ``~/.sentry/sentry.conf.py`` and load it if it exists, and ``--config`` is not passed. You
may also set the ``SENTRY_CONFIG`` environment variable to override the default value of --config.

Configuring a Proxy
~~~~~~~~~~~~~~~~~~~

By default, Sentry runs on port 9000. Even if you change this, under normal conditions you won't be able to bind to
port 80. To get around this (and to avoid running Sentry as a privileged user, which you shouldn't), we recommend
you setup a simple web proxy.

Proxying with Apache
````````````````````

Apache requires the use of mod_proxy for forwarding requests::

    ProxyPass / http://localhost:9000/
    ProxyPassReverse / http://localhost:9000/

Proxying with Nginx
```````````````````

You'll use the builtin HttpProxyModule within Nginx to handle proxying::

    location / {
      proxy_pass         http://localhost:9000;
      proxy_redirect     off;

      proxy_set_header   Host             $host;
      proxy_set_header   X-Real-IP        $remote_addr;
      proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
    }

Integrating with an existing Django install
-------------------------------------------

The integrated setup is not recommended for production environments, but can be fairly easy to get up and running. It
simply requires you to plug the Sentry application into your existing Django project. Once installed, you simply
need to update your settings.py and add ``sentry``, ``dkombu``, and ``raven.contrib.django`` to ``INSTALLED_APPS``::

    INSTALLED_APPS = (
        'django.contrib.admin',
        'django.contrib.auth',
        'django.contrib.contenttypes',
        'django.contrib.sessions',

        # Make sure you add all three required apps
        'djkombu',
        'sentry',
        'raven.contrib.django',
        ...
    )

.. note:: Raven is a seperate project, and the official Python client for Sentry.

Next, add the required middleware to your settings::

    MIDDLEWARE_CLASSES = (
        ...
        'sentry.middleware.SentryMiddleware',
    )



You will also need to add ``sentry.web.urls`` to your url patterns::

    urlpatterns = patterns('',
        (r'^sentry/', include('sentry.web.urls')),
    )

We also highly recommend setting ``TEMPLATE_DEBUG = True`` in your environment (not to be confused with ``DEBUG``). This will allow
Sentry to receive template debug information when it hits a syntax error.

Finally, run ``python manage.py syncdb`` to create the database tables.

.. note::

   We recommend using South for migrations. Initial migrations have already been created for Sentry in sentry/migrations/ so you only need to run ``python manage.py migrate sentry`` instead of ``syncdb``

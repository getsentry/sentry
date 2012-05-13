Quickstart
==========

Some basic prerequisites which you'll need in order to run Sentry:

* Python 2.5, 2.6, or 2.7
* python-setuptools
* Ideally a real database (like PostgreSQL or MySQL)
* Likely a UNIX-based operating system

The recommended configuration of Sentry involves setting up a separate web server to handle your error
logging. This means that any number of Sentry clients simply pass on this information to your primary Sentry
server.

This guide will step you through setting up a virtualenv, installing the required packages,
and configuring the basic web service.

Setting up an Environment
-------------------------

The first thing you'll need is the Python ``virtualenv`` package. You probably already
have this, but if not, you can install it with::

  easy_install -U virtualenv

Once that's done, choose a location for the environment, and create it with the ``virtualenv``
command. For our guide, we're going to choose ``/www/sentry/``::

  virtualenv /www/sentry/

Finally, activate your virtualenv::

  source /www/sentry/bin/activate

.. note:: Activating the environment adjusts your PATH, so that things like easy_install now
          install into the virtualenv by default.

Install Sentry
--------------

Once you've got the environment setup, you can install Sentry and all its dependencies with
the same command you used to grab virtualenv::

  easy_install -U sentry

Don't be worried by the amount of dependencies Sentry has. We have a philosophy of using the right tools for
the job, and not reinventing them if they already exist.

Once everything's installed, you should be able to execute the Sentry CLI, via ``sentry``, and get something
like the following::

  $ sentry
  usage: sentry [--config=/path/to/settings.py] [command] [options]

Initializing the Configuration
------------------------------

Now you're going to want to initialize your configuration from a template, likely because you'll want to switch
off of sqlite, which is the default database.

To do this, you'll use the ``init`` command. You can specify an alternative configuration
path as the argument to init, otherwise it will use the default of ``~/.sentry/sentry.conf.py``.

::

    # the path is optional
    sentry init /etc/sentry.conf.py

The configuration for the server is based on ``sentry.conf.server``, which contains a basic Django project
configuration, as well as the default Sentry configuration values. It will use SQLite for the database.

::

    # ~/.sentry/sentry.conf.py

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql_psycopg2',  # We suggest PostgreSQL for optimal performance
            'NAME': 'sentry',
            'USER': 'postgres',
            'PASSWORD': '',
            'HOST': '',
            'PORT': '',
        }
    }

    # No trailing slash!
    SENTRY_URL_PREFIX = 'http://sentry.example.com'

    # SENTRY_KEY is a unique randomly generated secret key for your server, and it
    # acts as a signing token
    SENTRY_KEY = '0123456789abcde'

    SENTRY_WEB_HOST = '0.0.0.0'
    SENTRY_WEB_PORT = 9000
    SENTRY_WEB_OPTIONS = {
        'workers': 3,  # the number of gunicorn workers
        # 'worker_class': 'gevent',
    }


.. note:: We highly recommend using the gevent worker class. To do this, simply ``pip install gevent`` and
          adjust the worker_class setting in ``SENTRY_WEB_OPTIONS``.

Configure Outbound Mail
-----------------------

Several settings exist as part of the Django framework which will configure your outbound mail server. For the
standard implementation, using a simple SMTP server, you can simply configure the following::

    EMAIL_HOST = 'localhost'
    EMAIL_HOST_PASSWORD = ''
    EMAIL_HOST_USER = ''
    EMAIL_PORT = 25
    EMAIL_USE_TLS = False

Being that Django is a pluggable framework, you also have the ability to specify different mail backends. See the
`official Django documentation <https://docs.djangoproject.com/en/1.3/topics/email/?from=olddocs#email-backends>`_ for
more information on alterantive backends.

Running Migrations
------------------

If you changed from the default SQLite database, make sure you start by creating the database Sentry
is expecting. Once done, you can create the initial database using the ``upgrade`` command::

    sentry --config=/etc/sentry.conf.py upgrade

**It's very important that you create the default superuser through the upgrade process. If you do not, there is
a good chance you'll see issues in your initial install.**

If you did not create the user on the first run, you can correct this by doing the following::

    # create a new user
    sentry --config=/etc/sentry.conf.py createsuperuser

    # run the automated repair script
    sentry --config=/etc/sentry.conf.py repair --owner=<username>

All schema changes and database upgrades are handled via the ``upgrade`` command, and this is the first
thing you'll want to run when upgrading to future versions of Sentry.

.. note:: Internally, this uses `South <http://south.aeracode.org>`_ to manage database migrations.

Starting the Web Service
------------------------

Sentry provides a built-in webserver (powered by gunicorn and eventlet) to get you off the ground quickly.

To start the webserver, you simply use ``sentry start``. If you opted to use an alternative configuration path
you can pass that via the --config option.

::

  # Sentry's server runs on port 9000 by default. Make sure your client reflects
  # the correct host and port!
  sentry --config=/etc/sentry.conf.py start

You should now be able to test the web service by visiting `http://localhost:9000/`.

Setup a Reverse Proxy
---------------------

By default, Sentry runs on port 9000. Even if you change this, under normal conditions you won't be able to bind to
port 80. To get around this (and to avoid running Sentry as a privileged user, which you shouldn't), we recommend
you setup a simple web proxy.

Proxying with Apache
~~~~~~~~~~~~~~~~~~~~

Apache requires the use of mod_proxy for forwarding requests::

    ProxyPass / http://localhost:9000/
    ProxyPassReverse / http://localhost:9000/

Proxying with Nginx
~~~~~~~~~~~~~~~~~~~

You'll use the builtin HttpProxyModule within Nginx to handle proxying::

    location / {
      proxy_pass         http://localhost:9000;
      proxy_redirect     off;

      proxy_set_header   Host             $host;
      proxy_set_header   X-Real-IP        $remote_addr;
      proxy_set_header   X-Forwarded-For  $proxy_add_x_forwarded_for;
    }

Running Sentry as a Service
---------------------------

We recommend using whatever software you are most familiar with for managing Sentry processes. For us, that software
of choice is `Supervisor <http://supervisord.org/>`_.

Configure ``supervisord``
~~~~~~~~~~~~~~~~~~~~~~~~~

Configuring Supervisor couldn't be more simple. Just point it to the ``sentry`` executable in your virtualenv's bin/
folder and you're good to go.

::

  [program:sentry-web]
  directory=/www/sentry/
  command=/www/sentry/bin/sentry start http
  autostart=true
  autorestart=true
  redirect_stderr=true

Additional Utilities
--------------------

If you're familiar with Python you'll quickly find yourself at home, and even more so if you've used Django. The
``sentry`` command is just a simple wrapper around Django's ``django-admin.py``, which means you get all of the
power and flexibility that goes with it.

Some of those which you'll likely find useful are::

createsuperuser
~~~~~~~~~~~~~~~

Quick and easy creation of superusers. These users have full access to the entirety of the Sentry server.

runserver
~~~~~~~~~

Testing Sentry locally? Spin up Django's builtin runserver (or ``pip install django-devserver`` for something
slightly better).

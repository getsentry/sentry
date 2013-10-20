Quickstart
==========

Some basic prerequisites which you'll need in order to run Sentry:

* Python 2.5, 2.6, or 2.7
* python-setuptools, python-dev
* Ideally a real database (like PostgreSQL or MySQL)
* Likely a UNIX-based operating system

The recommended configuration of Sentry involves setting up a separate web server to handle your error
logging. This means that any number of Sentry clients simply pass on this information to your primary Sentry
server.

This guide will step you through setting up a virtualenv, installing the required packages,
and configuring the basic web service.

Hardware
--------

Sentry is designed to scale up (to some extent) as you need it. The primary bottleneck will be your database
and the level of concurrency you can handle. That said, it's very unlikey you'll ever reach a point where Sentry
cannot scale on commodity hardware.

We don't have any real numbers to tell you what kind of hardware you're going to need, but we'll help you make
your decision based on existing usage from real customers.

Our primary point of view for Sentry's requirements is going to be Disqus. As of time of writing, Disqus handles
almost 2 million events a day on a single physical server, which hosts both the database and the Sentry web
components. The server runs two quad-core processors and has 16GB physical memory. It also runs standard 10k
RPM drives. Given the amount of resources available, Sentry barely uses any of it. It's likely that without
any tweaks to the configuration, the hardware Disqus is on could handle 10 million events/day before it hit
any real limitations.

That said, Disqus is also not configured in an optimal high-concurrency setup. There are many optimizations
within Sentry that can help with concurrency, one such optimization is the update buffers (described elsewhere).

Setting up an Environment
-------------------------

The first thing you'll need is the Python ``virtualenv`` package. You probably already
have this, but if not, you can install it with::

  easy_install -UZ virtualenv

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

  easy_install -UZ sentry

Don't be worried by the amount of dependencies Sentry has. We have a philosophy of using the right tools for
the job, and not reinventing them if they already exist.

Using MySQL or Postgres
~~~~~~~~~~~~~~~~~~~~~~~

We **highly** recommend using PostgreSQL for your database, or MySQL if you have no other choice. The default
is sqlite and will handle very little load.

These databases require additional packages, but Sentry provides a couple of meta packages to make things easier:

::

  # install sentry and its postgresql dependencies
  easy_install -UZ sentry[postgres]

  # or if you choose, mysql
  easy_install -UZ sentry[mysql]


Installing from Source
~~~~~~~~~~~~~~~~~~~~~~

If you're installing the Sentry source (e.g. from git), you'll simply need to run the ``make`` command to
get all of the dependencies::

  # all things should be this easy
  make

Once everything's installed, you should be able to execute the Sentry CLI, via ``sentry``, and get something
like the following::

  $ sentry
  usage: sentry [--config=/path/to/settings.py] [command] [options]


Initializing the Configuration
------------------------------

Now you'll need to create the default configuration. To do this, you'll use the ``init`` command
You can specify an alternative configuration path as the argument to init, otherwise it will use
the default of ``~/.sentry/sentry.conf.py``.

::

    # the path is optional
    sentry init /etc/sentry.conf.py

The configuration for the server is based on ``sentry.conf.server``, which contains a basic Django project
configuration, as well as the default Sentry configuration values. It defaults to SQLite, however **SQLite
is not a fully supported database and should not be used in production**.

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
            'OPTIONS': {
                'autocommit': True,
            }
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
        'secure_scheme_headers': {'X-FORWARDED-PROTO': 'https'},  # detect HTTPS mode from X-Forwarded-Proto header
    }


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
more information on alternative backends.

Running Migrations
------------------

Sentry provides an easy way to run migrations on the database on version upgrades. Before running it for
the first time you'll need to make sure you've created the database:

::

    # If you're using Postgres, and kept the database ``NAME`` as ``sentry``
    createdb -E utf-8 sentry

Once done, you can create the initial schema using the ``upgrade`` command::

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

Sentry provides a built-in webserver (powered by gunicorn and eventlet) to get you off the ground quickly,
also you can setup Sentry as WSGI application, in that case skip to section `Running Sentry as WSGI application`.

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
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https" env=HTTPS

You will need to enable ``headers``, ``proxy``, and ``proxy_http`` apache modules to use these settings.

Proxying with Nginx
~~~~~~~~~~~~~~~~~~~

You'll use the builtin HttpProxyModule within Nginx to handle proxying::

    location / {
      proxy_pass         http://localhost:9000;
      proxy_redirect     off;

      proxy_set_header   Host              $host;
      proxy_set_header   X-Real-IP         $remote_addr;
      proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header   X-Forwarded-Proto $scheme;
    }

See :doc:`nginx` for more details on using Nginx.

Enabling SSL
~~~~~~~~~~~~~

If you are planning to use SSL, you will also need to ensure that you've
enabled detection within the reverse proxy (see the instructions above), as
well as within the Sentry configuration:

::

    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

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


Enabling Social Auth
--------------------

Most of the time it doesnt really matter **how** someone authenticates to the service, so much as it that they do. In
these cases, Sentry provides tight integrated with several large social services, including: Twitter, Facebook, Google,
and GitHub. Enabling this is as simple as setting up an application with the respective services, and configuring a
couple values in your ``sentry.conf.py`` file.

By default, users will be able to both signup (create a new account) as well as associate an existing account. If you
want to disable account creation, simply set the following value::

  SOCIAL_AUTH_CREATE_USERS = False

Twitter
~~~~~~~

Register an application at http://twitter.com/apps/new. Take the values given on the page, and configure
the following::

  TWITTER_CONSUMER_KEY = ''
  TWITTER_CONSUMER_SECRET = ''

.. note:: It's important that input a callback URL, even if its useless. We have no idea why, consult Twitter.

Facebook
~~~~~~~~

Register an application at http://developers.facebook.com/setup/. You'll also need to make sure you select the "Website
with Facebook Login" and fill in the Site URL field (just use the website's URL you're install Sentry on). Take the
values given on the page, and configure the following::

  FACEBOOK_APP_ID = ''
  FACEBOOK_API_SECRET = ''

Google
~~~~~~

Register an application at http://code.google.com/apis/accounts/docs/OAuth2.html#Registering. Take the values given on the page, and configure
the following::

  GOOGLE_OAUTH2_CLIENT_ID = ''
  GOOGLE_OAUTH2_CLIENT_SECRET = ''

GitHub
~~~~~~

Register an application at https://github.com/settings/applications/new. Take the values given on the page, and configure
the following::

  GITHUB_APP_ID = ''
  GITHUB_API_SECRET = ''

For more information on configuring social authentication services, consult the `documentation on django-social-auth
<https://github.com/omab/django-social-auth/>`_.

Trello
~~~~~~

Generate an application key at https://trello.com/1/appKey/generate. Take the values given on the page, and configure
the following::

  TRELLO_API_KEY = ''
  TRELLO_API_SECRET = ''

What's Next?
------------

There are several applications you may want to add to the default Sentry install for various security or other uses. This
is a bit outside of the scope of normal (locked down) installs, as typically you'll host things on your internal network. That
said, you'll first need to understand how you can modify the default settings.

First pop open your ``sentry.conf.py``, and add the following to the **very top** of the file::

  from sentry.conf.server import *

Now you'll have access to all of the default settings (Django and Sentry) to modify at your own will.

If you're running in the public domain, we highly recommend looking into `django-secure <http://pypi.python.org/pypi/django-secure>`_
and `django-bcrypt <http://pypi.python.org/pypi/django-bcrypt>`_ to lock down your installation with a little bit more
security. For example, to change the password storage to bcrypt (rather than the Django default), you would add the
following to your ``sentry.conf.py``::

  INSTALLED_APPS = INSTALLED_APPS + (
      'django_bcrypt',
  )

Configuring Memcache
~~~~~~~~~~~~~~~~~~~~

You'll also want to consider configuring cache and buffer settings, which respectively require a cache server and a Redis
server. While the Django configuration covers caching in great detail, Sentry allows you to specify a backend for its
own internal purposes:

::

  # You'll need to install django-pyblibmc for this example to work
  CACHES = {
      'default': {
          'BACKEND': 'django_pylibmc.memcached.PyLibMCCache',
          'LOCATION': 'localhost:11211',
      }
  }

  SENTRY_CACHE_BACKEND = 'default'

See :doc:`../buffer/index` for information on how to configure update buffers to improve performance on concurrent writes.

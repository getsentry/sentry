Installation
============

This guide will step you through setting up a Python-based virtualenv,
installing the required packages, and configuring the basic web service.

Dependencies
------------

Some basic prerequisites which you'll need in order to run Sentry:

* A UNIX-based operating system. We test on Ubuntu and this documentation
  assumes an ubuntu based system.
* Python 2.7
* ``python-setuptools``, ``python-pip``, ``python-dev``, ``libxslt1-dev``,
  ``libxml2-dev``, ``libz-dev``, ``libffi-dev``, ``libssl-dev``
* A real database (PostgreSQL is preferred, MySQL also works with caveats)
* Redis
* Nginx (with RealIP, i.e. ``nginx-full``)
* A dedicated domain to host Sentry on (i.e. `sentry.yourcompany.com`).

Hardware
--------

Sentry provides a number of mechanisms to scale its capacity out
horizontally, however there is still a primary SPOF at the database level.
In an HA setup, the database is only utilized for event indexing and basic
data storage, and becomes much less of a capacity concern (see also
:doc:`nodestore`).

We don't have any real numbers to tell you what kind of hardware you're
going to need, but we'll help you make your decision based on existing
usage from real customers.

If you're looking for an HA, and high throughput setup, you're going to
need to setup a fairly complex cluster of machines, and utilize all of
Sentry's advanced configuration options.  This means you'll need Postgres,
Riak, Redis, Memcached, and RabbitMQ.  It's very rare you'd need this
complex of a cluster, and the primary usecase for this is for the
Hosted Sentry on `getsentry.com <https://getsentry.com/>`_.

For more typical, but still fairly high throughput setups, you can run off
of a single machine as long as it has reasonable IO (ideally SSDs), and a
good amount of memory.

The main things you need to consider are:

- TTL on events (how long do you need to keep historical data around)
- Average event throughput
- How many events get grouped together (which means they get sampled)

At a point, getsentry.com was processing approximately 4 million events a
day. A majority of this data is stored for 90 days, which accounted for
around 1.5TB of SSDs. Web and worker nodes were commodity (8GB-12GB RAM,
cheap SATA drives, 8 cores), the only two additional nodes were a
dedicated RabbitMQ and Postgres instance (both on SSDs, 12GB-24GB of
memory). In theory, given a single high-memory machine, with 16+ cores,
and SSDs, you could handle the entirety of the given data set.

Setting up an Environment
-------------------------

The first thing you'll need is the Python ``virtualenv`` package. You
probably already have this, but if not, you can install it with::

    pip install -U virtualenv

It's also available as ``python-virtualenv`` on ubuntu in the package
manager.

Once that's done, choose a location for the environment, and create it
with the ``virtualenv`` command. For our guide, we're going to choose
``/www/sentry/``::

    virtualenv /www/sentry/

Finally, activate your virtualenv::

    source /www/sentry/bin/activate

.. note:: Activating the environment adjusts your ``PATH``, so that things
          like pip now install into the virtualenv by default.

Install Sentry
--------------

Once you've got the environment setup, you can install Sentry and all its
dependencies with the same command you used to grab virtualenv::

  pip install -U sentry

Don't be worried by the amount of dependencies Sentry has. We have a
philosophy of using the right tools for the job, and not reinventing them
if they already exist.

Once everything's installed, you should be able to execute the Sentry CLI,
via ``sentry``, and get something like the following:

.. code-block:: bash

  $ sentry
  usage: sentry [--config=/path/to/settings.py] [command] [options]


Using Postgres or MySQL
~~~~~~~~~~~~~~~~~~~~~~~

We **highly** recommend using PostgreSQL for your database, or MySQL if
you have no other choice. The default is sqlite and will handle very
little load. If you're using MySQL, you should use InnoDB as your storage
engine.

These databases require additional packages, but Sentry provides a couple
of meta packages to make things easier:

::

    # install sentry and its postgresql dependencies
    pip install -U sentry[postgres]

    # or if you choose, mysql
    pip install -U sentry[mysql]


Installing from Source
~~~~~~~~~~~~~~~~~~~~~~

If you're installing the Sentry source (e.g. from git), you'll also need
to install ``npm``.

Once your system is prepared, symlink your source into the virtualenv:

.. code-block:: bash

  $ python setup.py develop

.. Note:: This command will install npm dependencies as well as compile
          static assets.


Initializing the Configuration
------------------------------

Now you'll need to create the default configuration. To do this, you'll
use the ``init`` command You can specify an alternative configuration path
as the argument to init, otherwise it will use the default of
``~/.sentry/sentry.conf.py``.

::

    # the path is optional
    sentry init /etc/sentry.conf.py

The configuration for the server is based on ``sentry.conf.server``, which
contains a basic Django project configuration, as well as the default
Sentry configuration values. It defaults to SQLite, however **SQLite is
not a fully supported database and should not be used in production**.

::

    # ~/.sentry/sentry.conf.py

    # for more information on DATABASES, see the Django configuration at:
    # https://docs.djangoproject.com/en/1.6/ref/databases/
    DATABASES = {
        'default': {
            # We suggest PostgreSQL for optimal performance
            'ENGINE': 'django.db.backends.postgresql_psycopg2',

            # Alternatively you can use MySQL
            'ENGINE': 'django.db.backends.mysql',

            'NAME': 'sentry',
            'USER': 'postgres',
            'PASSWORD': '',
            'HOST': '',
            'PORT': '',
        }
    }

    # No trailing slash!
    SENTRY_URL_PREFIX = 'http://sentry.example.com'

    SENTRY_WEB_HOST = '0.0.0.0'
    SENTRY_WEB_PORT = 9000
    SENTRY_WEB_OPTIONS = {
        'workers': 3,  # the number of gunicorn workers
        # detect HTTPS mode from X-Forwarded-Proto header
        'secure_scheme_headers': {'X-FORWARDED-PROTO': 'https'},
    }


Configure Redis
---------------

Redis is used as the default implementation for various backend services,
including the time-series storage, SQL update buffers, and rate limiting.

We recommend running two separate Redis clusters: one for persistent data
(TSDB) and one for temporal data (buffers, rate limits). This is because
you can configure the nodes in very different ones to enable more
aggressive/optimized LRU.

That said, if you're running a small install you can probably get away
with just setting up the defaults::

    SENTRY_REDIS_OPTIONS = {
        'hosts': {
            0: {
                'host': '127.0.0.1',
                'port': 6379,
                'timeout': 3,
                #'password': 'redis auth password'
            }
        }
    }

All built-in Redis implementations (other than the queue) will use these
default settings, but each individual service also will allow you to
override it's cluster settings.

See the individual documentation for :doc:`the queue <queue/>`,
:doc:`update buffers <buffer>`, :doc:`quotas <throttling>`, and
:doc:`time-series storage <tsdb>` for more details.

Configure Outbound Mail
-----------------------

Several settings exist as part of the Django framework which will
configure your outbound mail server. For the standard implementation,
using a simple SMTP server, you can simply configure the following:

.. code-block:: python

    EMAIL_HOST = 'localhost'
    EMAIL_HOST_PASSWORD = ''
    EMAIL_HOST_USER = ''
    EMAIL_PORT = 25
    EMAIL_USE_TLS = False

Being that Django is a pluggable framework, you also have the ability to
specify different mail backends. See the `official Django documentation
<https://docs.djangoproject.com/en/1.3/topics/email/?from=olddocs#email-backends>`_
for more information on alternative backends.

Running Migrations
------------------

Sentry provides an easy way to run migrations on the database on version
upgrades. Before running it for the first time you'll need to make sure
you've created the database:

.. code-block:: bash

    # If you're using Postgres, and kept the database ``NAME`` as ``sentry``
    $ createdb -E utf-8 sentry

    # alternatively if you're using MySQL, ensure you've created the database:
    $ mysql -e 'create database sentry'

Once done, you can create the initial schema using the ``upgrade``
command:

.. code-block:: python

    $ sentry --config=/etc/sentry.conf.py upgrade

Next up you'll need to create the first user, which will act as a superuser:

.. code-block:: bash

    # create a new user
    $ sentry --config=/etc/sentry.conf.py createuser

All schema changes and database upgrades are handled via the ``upgrade``
command, and this is the first thing you'll want to run when upgrading to
future versions of Sentry.

.. note:: Internally, this uses `South <http://south.aeracode.org>`_ to
          manage database migrations.

Starting the Web Service
------------------------

Sentry provides a built-in webserver (powered by gunicorn and eventlet) to
get you off the ground quickly, also you can setup Sentry as WSGI
application, in that case skip to section `Running Sentry as WSGI
application`.

To start the webserver, you simply use ``sentry start``. If you opted to
use an alternative configuration path you can pass that via the --config
option.

::

  # Sentry's server runs on port 9000 by default. Make sure your client reflects
  # the correct host and port!
  sentry --config=/etc/sentry.conf.py start

You should now be able to test the web service by visiting `http://localhost:9000/`.

.. note:: This doesn't run any workers in the background, so assuming
          queueing is enabled (default in 7.0.0+) no asyncrhonous tasks
          will be running.

Starting the Workers
--------------------

A large amount of Sentry's work is typically done via it's workers. While
Sentry will seemingly work without using a queue you will not actually see
anything show up in Sentry.  Once you've configured the queue, you'll also
need to run workers. Generally, this is as simple as running "celery" from
the Sentry CLI.

So do not forget to run the workers!

::

  sentry --config=/etc/sentry.conf.py celery worker -B

Technically there is a way to run sentry without the queues by setting
``CELERY_ALWAYS_EAGER`` to `True` but this is heavily discouraged and not
supported.

.. note:: `Celery <http://celeryproject.org/>`_ is an open source task
          framework for Python.

Setup a Reverse Proxy
---------------------

By default, Sentry runs on port 9000. Even if you change this, under
normal conditions you won't be able to bind to port 80. To get around this
(and to avoid running Sentry as a privileged user, which you shouldn't),
we recommend you setup a simple web proxy.

Proxying with Apache
~~~~~~~~~~~~~~~~~~~~

Apache requires the use of mod_proxy for forwarding requests::

    ProxyPass / http://localhost:9000/
    ProxyPassReverse / http://localhost:9000/
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https" env=HTTPS

You will need to enable ``headers``, ``proxy``, and ``proxy_http`` apache
modules to use these settings.

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

.. code-block:: python

    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

Running Sentry as a Service
---------------------------

We recommend using whatever software you are most familiar with for
managing Sentry processes. For us, that software of choice is `Supervisor
<http://supervisord.org/>`_.

Configure ``supervisord``
~~~~~~~~~~~~~~~~~~~~~~~~~

Configuring Supervisor couldn't be more simple. Just point it to the
``sentry`` executable in your virtualenv's bin/ folder and you're good to
go.

::

  [program:sentry-web]
  directory=/www/sentry/
  command=/www/sentry/bin/sentry start
  autostart=true
  autorestart=true
  redirect_stderr=true
  stdout_logfile syslog
  stderr_logfile syslog

  [program:sentry-worker]
  directory=/www/sentry/
  command=/www/sentry/bin/sentry celery worker -B
  autostart=true
  autorestart=true
  redirect_stderr=true
  stdout_logfile syslog
  stderr_logfile syslog


Removing Old Data
-----------------

One of the most important things you're going to need to be aware of is
storage costs. You'll want to setup a cron job that runs to automatically
trim stale data. This won't guarantee space is reclaimed (i.e. by SQL),
but it will try to minimize the footprint. This task is designed to run
under various environments so it doesn't delete things in the most optimal
way possible, but as long as you run it routinely (i.e. daily) you should
be fine.

.. code-block:: bash

  $ crontab -e
  0 3 * * * sentry cleanup --days=30


Additional Utilities
--------------------

If you're familiar with Python you'll quickly find yourself at home, and
even more so if you've used Django. The ``sentry`` command is just a
simple wrapper around Django's ``django-admin.py``, which means you get
all of the power and flexibility that goes with it.

Some of those which you'll likely find useful are:

createuser
~~~~~~~~~~

Quick and easy creation of superusers. These users have full access to the
entirety of the Sentry server.

runserver
~~~~~~~~~

Testing Sentry locally? Spin up Django's builtin runserver (or ``pip
install django-devserver`` for something slightly better).


Enabling Third Party Auth
-------------------------

Most of the time it doesn't really matter **how** someone authenticates to
the service, so much as it that they do. In these cases, Sentry provides
integrating with several common services, including: Google and GitHub.
Enabling this is as simple as setting up an application with the
respective services, and configuring a couple values in your
``sentry.conf.py`` file.

By default, users will be able to both signup (create a new account) as
well as associate an existing account. If you want to disable account
creation, simply set the following value::

  SENTRY_FEATURES = {
    'social-auth:register': False,
  }


Google
~~~~~~

Register an application at
http://code.google.com/apis/accounts/docs/OAuth2.html#Registering. Take
the values given on the page, and configure the following::

  GOOGLE_OAUTH2_CLIENT_ID = ''
  GOOGLE_OAUTH2_CLIENT_SECRET = ''


GitHub
~~~~~~

Register an application at https://github.com/settings/applications/new.
Take the values given on the page, and configure the following::

  GITHUB_APP_ID = ''
  GITHUB_API_SECRET = ''

For more information on configuring social authentication services,
consult the `documentation on django-social-auth
<https://github.com/omab/django-social-auth/>`_.


What's Next?
------------

There are several applications you may want to add to the default Sentry
install for various security or other uses. This is a bit outside of the
scope of normal (locked down) installs, as typically you'll host things on
your internal network. That said, you'll first need to understand how you
can modify the default settings.

First pop open your ``sentry.conf.py``, and add the following to the
**very top** of the file::

  from sentry.conf.server import *

Now you'll have access to all of the default settings (Django and Sentry)
to modify at your own will.

We recommend going over all of the defaults in the generated settings
file, and familiarizing yourself with how the system is setup.

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
  ``libxml2-dev``, ``libz-dev``, ``libffi-dev``, ``libssl-dev``, ``libpq-dev``,
  ``libyaml-dev``
* `PostgreSQL <http://www.postgresql.org/>`_
* `Redis <http://redis.io>`_ (the minimum version requirement is 2.8.9, but 2.8.18, 3.0, or newer are recommended)

  * If running Ubuntu < 15.04, you'll need to install from a different PPA.
    We recommend `chris-lea/redis-server <https://launchpad.net/~chris-lea/+archive/ubuntu/redis-server>`_
* `Nginx <http://nginx.org>`_ (``nginx-full``)
* A dedicated domain to host Sentry on (i.e. `sentry.yourcompany.com`).

If you're building from source you'll also need:

* Node.js 0.12 or newer.

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
          like ``pip`` now install into the virtualenv by default.

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
  Usage: sentry [OPTIONS] COMMAND [ARGS]...

    Sentry is cross-platform crash reporting built with love.

  Options:
    --config PATH  Path to configuration files.
    --version      Show the version and exit.
    --help         Show this message and exit.

  Commands:
    celery      Start background workers.
    cleanup     Delete a portion of trailing data based on...
    config      Manage runtime config options.
    createuser  Create a new user.
    devserver   Start a light Web server for development.
    django      Execute Django subcommands.
    export      Exports core metadata for the Sentry...
    help        Show this message and exit.
    import      Imports data from a Sentry export.
    init        Initialize new configuration directory.
    repair      Attempt to repair any invalid data.
    shell       Run a Python interactive interpreter.
    start       Start running a service.
    upgrade     Perform any pending database migrations and...


Installing from Source
~~~~~~~~~~~~~~~~~~~~~~

If you're installing the Sentry source (e.g. from git), you'll also need
to install ``npm``.

Once your system is prepared, symlink your source into the virtualenv:

.. code-block:: bash

  $ python setup.py develop

.. Note:: This command will install npm dependencies as well as compile
          static assets.

You can also use pip to directly install the package from GitHub:

.. code-block:: bash

  $ pip install -e git+https://github.com/getsentry/sentry.git@master#egg=sentry-dev

And more importantly, you can easily pin to a specific SHA:

.. code-block:: bash

  $ pip install -e git+https://github.com/getsentry/sentry.git@___SHA___#egg=sentry-dev


Initializing the Configuration
------------------------------

Now you'll need to create the default configuration. To do this, you'll
use the ``init`` command You can specify an alternative configuration path
as the argument to init, otherwise it will use the default of
``~/.sentry``.

::

    # the path is optional
    sentry init /etc/sentry

Starting with 8.0.0, ``init`` now creates two files, ``sentry.conf.py`` and
``config.yml``. To avoid confusion, ``config.yml`` will slowly be replacing
``sentry.conf.py``, but right now, the uses of ``config.yml`` are limited.

The configuration inherits all of the server defaults, but you may need to
change certain things, such as the database connection:

::

    # ~/.sentry/sentry.conf.py

    # for more information on DATABASES, see the Django configuration at:
    # https://docs.djangoproject.com/en/1.6/ref/databases/
    DATABASES = {
        'default': {
            'ENGINE': 'sentry.db.postgres',
            'NAME': 'sentry',
            'USER': 'postgres',
            'PASSWORD': '',
            'HOST': '',
            'PORT': '',
        }
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
with just setting up the defaults in ``config.yml``::

    redis.clusters:
      default:
        hosts:
          0:
            host: 127.0.0.1
            port: 6379
            # password: "my-secret-password"

All built-in Redis implementations (other than the queue) will use these
default settings, but each individual service also will allow you to
override it's cluster settings by passing the name of the cluster to use as the
``cluster`` option.

Cluster options are passed directly to rb (a Redis routing library) as keyword
arguments to the ``Cluster`` constructor. A more thorough discussion of the
availabile configuration parameters can be found at the `rb GitHub repository
<https://github.com/getsentry/rb>`_.

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

    # If you kept the database ``NAME`` as ``sentry``
    $ createdb -E utf-8 sentry

Once done, you can create the initial schema using the ``upgrade`` command:

.. code-block:: python

    $ SENTRY_CONF=/etc/sentry sentry upgrade

Next up you'll need to create the first user, which will act as a superuser:

.. code-block:: bash

    # create a new user
    $ SENTRY_CONF=/etc/sentry sentry createuser

All schema changes and database upgrades are handled via the ``upgrade``
command, and this is the first thing you'll want to run when upgrading to
future versions of Sentry.

.. note:: Internally this uses `South <http://south.aeracode.org>`_ to
          manage database migrations.

Starting the Web Service
------------------------

Sentry provides a built-in webserver (powered by uWSGI) to
get you off the ground quickly, also you can setup Sentry as WSGI
application, in that case skip to section `Running Sentry as WSGI
application`.

To start the built-in webserver run ``sentry start``:

::

  SENTRY_CONF=/etc/sentry sentry start

You should now be able to test the web service by visiting `http://localhost:9000/`.

Starting Background Workers
---------------------------

A large amount of Sentry's work is managed via background workers. These need run
in addition to the web service workers:

::

  SENTRY_CONF=/etc/sentry sentry celery worker

See :doc:`queue` for more details on configuring workers.

.. note:: `Celery <http://celeryproject.org/>`_ is an open source task
          framework for Python.

Starting the Cron Process
-------------------------

Sentry also needs a cron process which is called "celery beat":

::

  SENTRY_CONF=/etc/sentry sentry celery beat

It's recommended to only run one of them at the time or you will see
unnecessary extra tasks being pushed onto the queues but the system will
still behave as intended if multiple beat processes are run.  This can be
used to achieve high availability.

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
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

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
  environment=SENTRY_CONF="/etc/sentry"
  command=/www/sentry/bin/sentry start
  autostart=true
  autorestart=true
  redirect_stderr=true
  stdout_logfile=syslog
  stderr_logfile=syslog

  [program:sentry-worker]
  directory=/www/sentry/
  environment=SENTRY_CONF="/etc/sentry"
  command=/www/sentry/bin/sentry celery worker
  autostart=true
  autorestart=true
  redirect_stderr=true
  stdout_logfile=syslog
  stderr_logfile=syslog

  [program:sentry-cron]
  directory=/www/sentry/
  environment=SENTRY_CONF="/etc/sentry"
  command=/www/sentry/bin/sentry celery beat
  autostart=true
  autorestart=true
  redirect_stderr=true
  stdout_logfile=syslog
  stderr_logfile=syslog


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


What's Next?
------------

At this point you should have a fully functional installation of Sentry. You
may want to explore :doc:`various plugins <plugins>` available.

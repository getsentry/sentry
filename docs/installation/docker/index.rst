Installation with Docker
========================

This guide will step you through setting up your own on-premise Sentry
in `Docker <https://www.docker.com/>`_.

Dependencies
------------

* `Docker version 1.10+ <https://www.docker.com/getdocker>`_

Building Container
------------------

Start by cloning or forking
`getsentry/onpremise <https://github.com/getsentry/onpremise>`_. This
will act the base for your own custom Sentry.

Inside of this repository, we have a ``sentry.conf.py`` and
``config.yml`` ready for :doc:`customizing <../../config>`.

On top of that, we have a ``requirements.txt`` file for
:doc:`installing plugins <../../plugins>`.

Now we need to build our custom image. We have two ways to do this,
depending on your environment. If you have a custom registry you're
going to need to push to::

    REPOSITORY=registry.example.com/sentry make build push

If not, you can just build locally::

    make build

If you plan on running the dependent services in Docker as well, we
support linking containers.

Running Dependent Services
--------------------------

*Running the dependent services in Docker is entirely optional*, but
you may, and we fully support linking containers to get up and running
quickly.

Redis
~~~~~

::

    docker run \
      --detach \
      --name sentry-redis \
      redis:3.2-alpine

PostgreSQL
~~~~~~~~~~

::

    docker run \
      --detach \
      --name sentry-postgres \
      --env POSTGRES_PASSWORD=secret \
      --env POSTGRES_USER=sentry \
      postgres:9.5

Outbound Email
~~~~~~~~~~~~~~

::

    docker run \
      --detach \
      --name sentry-smtp \
      tianon/exim4

Running Sentry Services
-----------------------

.. note:: The image that is built, acts as the entrypoint for all
          running pieces for the Sentry application and the same image
          must be used for all containers.

``${REPOSITORY}`` corresponds to the name used when building your
image in the previous step. If this wasn't specified, the default is
``sentry-onpremise``. To test that the image is working correctly, you can do::

    docker run \
      --rm ${REPOSITORY} \
      --help

You should see the Sentry help output.

At this point, you'll need to generate a ``secret-key`` value. You can do that with::

    docker run \
      --rm ${REPOSITORY} \
      config generate-secret-key

This value can be put into your ``config.yml``, or as an environment
variable ``SENTRY_SECRET_KEY``. If putting into ``config.yml``, you
must rebuild your image.

For all future Sentry command invocations, you just have all the
necessary container links, mounted volumes, and the same environment
variables. If differet components are running with different
configurations, Sentry will likely have unexpected behaviors.

The base for running commands will look something like::

    docker run \
      --detach \
      --rm \
      --link sentry-redis:redis \
      --link sentry-postgres:postgres \
      --link sentry-smtp:smtp \
      --env SENTRY_SECRET_KEY=${SENTRY_SECRET_KEY} \
      ${REPOSITORY} \
      <command>

.. note:: Further documentation will not mention container links or
          environment variables for sake of brevity, but they are
          required for all instances if using linked containers, and
          the ``${REPOSITORY}`` will be referenced as
          ``sentry-onpremise``.

Running Migrations
~~~~~~~~~~~~~~~~~~

::

    docker run --rm -it sentry-onpremise upgrade

During the upgrade, you will be prompted to create the initial user
which will act as the superuser.

All schema changes and database upgrades are handled via the
``upgrade`` command, and this is the first thing you'll want to run
when upgrading to future versions of Sentry.

Starting the Web Service
~~~~~~~~~~~~~~~~~~~~~~~~

The web interface needs to expose port 9000 into the container. This
can just be done with `--publish 9000:9000`::

    docker run \
      --detach \
      --name sentry-web-01 \
      --publish 9000:9000 \
      sentry-onpremise \
      run web


You should now be able to test the web service by visiting
``http://localhost:9000/``.

Starting Background Workers
~~~~~~~~~~~~~~~~~~~~~~~~~~~

A large amount of Sentry's work is managed via background workers::

    docker run \
      --detach \
      --name sentry-worker-01 \
      sentry-onpremise \
      run worker

See :doc:`../../queue` for more details on configuring workers.

Starting the Cron Process
~~~~~~~~~~~~~~~~~~~~~~~~~

Sentry also needs a cron process::

    docker run \
      --detach \
      --name sentry-cron \
      sentry-onpremise \
      run cron

It's recommended to only run one of them at the time or you will see
unnecessary extra tasks being pushed onto the queues but the system
will still behave as intended if multiple beat processes are run.
This can be used to achieve high availability.

What's Next?
------------

At this point, you should have a fully functional installation of
Sentry. You may want to explore :doc:`various plugins <../../plugins>`
available.

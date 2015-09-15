Asynchronous Workers
====================

Sentry comes with a built-in queue to process tasks in a more asynchronous
fashion. For example when an event comes in instead of writing it to the database
immediately, it sends a job to the queue so that the request can be returned right
away, and the background workers handle actually saving that data.

.. note:: We rely on the `Celery <http://celeryproject.org/>`_ library for managing workers.

Running a Worker
----------------

Workers can be run by using the Sentry CLI. Specifically, you call out to celery,
which is the worker manager process of the Celery library.

.. code-block:: bash

    $ sentry celery worker -B

.. note:: You will need to run both celery workers and celerybeat. In our
          example, the -B flag runs a beat instance (in addition to the worker),
          but in production you may want to run them separately.

We again recommend running this as a service. Below is an example
configuration with supervisor::

    [program:sentry-worker]
    directory=/www/sentry/
    command=/www/sentry/bin/sentry celery worker -B -l WARNING
    autostart=true
    autorestart=true
    redirect_stderr=true
    killasgroup=true


Configuring the Broker
----------------------

Sentry supports two primary brokers which may be adjusted depending on your
workload: RabbitMQ and Redis.

Redis
`````

The default broker is Redis, and will work under most situations. The primary
limitation to using Redis is that all pending work must fit in memory.

.. code-block:: python

    BROKER_URL = "redis://localhost:6379/0"


RabbitMQ
````````

If you run with a high workload, or have concerns about fitting the pending workload
in memory, then RabbitMQ is an ideal candidate for backing Sentry's workers.

.. code-block:: python

    BROKER_URL = "amqp://guest:guest@localhost:5672/sentry"

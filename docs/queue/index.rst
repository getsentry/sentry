Utilizing the Queue
===================

Sentry comes with a built-in queue to process tasks in a more asynchronous
fashion. For example, with workers enabled, when an event comes in instead
of writing it to the database immediately, it sends a job to the queue so
that the request can be returned right away, and the background workers
handle actually saving that data.

.. note:: As of version 3.3.0 the queue is now powered by `Celery <http://celeryproject.org/>`_.

Running a Worker
----------------

Workers can be run by using the Sentry CLI. Specifically, you call out to celery,
which is the worker manager process of the Celery library.

::

    sentry celery worker -B

.. note:: You will need to run both celery workers and celerybeat.

Enable the Queue
----------------

Once you've brought up a worker, the next step is to enable the queue. This is
done with a simple settings flag::

    CELERY_ALWAYS_EAGER = False

It's also **highly** recommended that you switch away from the default queue settings, which
rely on the database, and move to something more efficient. These are documented in more
details as part of the `Celery documentation <http://celeryproject.org/>`_, but something simple
like Redis will do just fine.

An example configuration using a local Redis server might look like this::

    BROKER_URL = "redis://localhost:6379/0"

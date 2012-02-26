Utilizing the Queue
===================

Sentry comes with a built-in queue to process tasks in a more asynchronous
fashion. For example, with workers enabled, when an event comes in instead
of writing it to the database immediately, it sends a job to the queue so
that the request can be returned right away, and the background workers
handle actually saving that data.

.. note:: As of version 3.3.0 the queue is now powered by Celery.

Running a Worker
------------~~~~

Workers can be run by using the Sentry CLI. Specifically, you call out to celeryd,
which the worker manager process of the Celery library.

    sentry celeryd

Enable the Queue
----------------

Once you've brought up a worker, the next step is to enable the queue. This is
done with a simple settings flag::

    SENTRY_USE_QUEUE = True
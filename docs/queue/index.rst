Utilizing the Queue
===================

Sentry comes with a built-in queue to process tasks in a more asynchronous
fashion. For example, with workers enabled, when an event comes in instead
of writing it to the database immediately, it sends a job to the queue so
that the request can be returned right away, and the background workers
handle actually saving that data.

Run a Worker
------------

Workers can be run by using the Sentry CLI. Specifically, you pass the 'worker'
service to the start command::

    sentry start worker

Enable the Queue
----------------

Once you've brought up a worker, the next step is to enable the queue. This is
done with a simple settings flag::

    SENTRY_USE_QUEUE = True
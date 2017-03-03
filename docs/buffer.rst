Write Buffers
=============

Sentry manages database row contention by buffering writes and flushing
bulk changes to the database over a period of time. This is extremely helpful
if you have high concurrency, especially if they're frequently the same event.

For example, if you happen to receive 100,000 events/second, and 10% of
those are reporting a connection issue to the database (where they'd get
grouped together), enabling a buffer backend will change things so that
each count update is actually put into a queue, and all updates are
performed at the rate of how fast the queue can keep up.

Configuration
-------------

To specify a backend, simply modify the ``SENTRY_BUFFER`` and
``SENTRY_BUFFER_OPTIONS`` values in your configuration:

.. code-block:: python

    SENTRY_BUFFER = 'sentry.buffer.base.Buffer'

Redis
`````

Configuring the Redis backend **requires the queue** or you won't see any
gains (in fact you'll just negatively impact your performance).

Configuration is straight forward:

.. code-block:: python

    SENTRY_BUFFER = 'sentry.buffer.redis.RedisBuffer'

By default, this will use the ``default`` named Redis cluster. To use a
different cluster, provide the ``cluster`` option, as such:

.. code-block:: python

    SENTRY_BUFFER_OPTIONS = {
        'cluster': 'buffer',
    }

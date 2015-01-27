Update Buffers
==============

Sentry provides the ability to buffer certain updates to events, such as counts and timestamps. This is
extremely helpful if you have high concurrency, especially if they're frequently the same event.

For example, if you happen to receive 100,000 events/second, and 10% of those are reporting a connection
issue to the database (where they'd get grouped together), enabling a buffer backend will change things
so that each count update is actually put into a queue, and all updates are performed at the rate of how
fast the queue can keep up.

Choosing a Backend
------------------

To specify a backend, simply modify the ``SENTRY_BUFFER`` and ``SENTRY_BUFFER_OPTIONS`` values in your configuration:

.. code-block:: python

    SENTRY_BUFFER = 'sentry.buffer.base.Buffer'
    SENTRY_BUFFER_OPTIONS = {}


The Redis Backend
-----------------

Configuring the Redis backend **requires the queue** or you won't see any gains (in fact you'll just negatively
impact your performance).

Configuration is fairly straight forward:

.. code-block:: python

    SENTRY_BUFFER = 'sentry.buffer.redis.RedisBuffer'
    SENTRY_BUFFER_OPTIONS = {
        'hosts': {
            0: {
                'host': 'localhost',
                'port': 6379
            }
        }
    }

Because the Redis buffer relies on the Nydus package, this gives you the ability to specify multiple nodes and
have keys automatically distributed. It's unlikely that you'll need this functionality, but if you do, a simple
configuration might look like this:

::

    SENTRY_BUFFER_OPTIONS = {
        'hosts': {
            0: {
                'host': '192.168.1.1'
            }
            1: {
                'host': '192.168.1.2'
            }
        },
    }

With the default configuration this will distribute keys using a simple partition router (relatively even
distribution).

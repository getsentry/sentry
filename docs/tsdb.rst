Time-series Storage
===================

Sentry provides a service to store time-series data. Primarily this is
used to display aggregate information for events and projects, as well as
calculating (in real-time) the rates of events.

Choosing a Backend
------------------

To specify a backend, simply modify the ``SENTRY_TSDB`` and
``SENTRY_TSDB_OPTIONS`` values in your configuration::

    SENTRY_TSDB = 'sentry.tsdb.dummy.DummyTSDB'
    SENTRY_TSDB_OPTIONS = {}


The Redis Backend
-----------------

Configuration is fairly straight forward::

    SENTRY_TSDB = 'sentry.tsdb.redis.RedisTSDB'
    SENTRY_TSDB_OPTIONS = {
        'hosts': {
            0: {
                'host': 'localhost',
                'port': 6379
            }
        }
    }

Because the Redis buffer relies on the Nydus package, this gives you the
ability to specify multiple nodes and have keys automatically distributed.
It's unlikely that you'll need this functionality, but if you do, a simple
configuration might look like this::

    SENTRY_TSDB_OPTIONS = {
        'hosts': {
            0: {
                'host': '192.168.1.1'
            }
            1: {
                'host': '192.168.1.2'
            }
        },
    }

With the default configuration this will distribute keys using a simple
partition router (relatively even distribution).

Time-series Storage
===================

Sentry provides a service to store time-series data. Primarily this is
used to display aggregate information for events and projects, as well as
calculating (in real-time) the rates of events.

Choosing a Backend
------------------

To specify a backend, simply modify the ``SENTRY_TSDB`` and
``SENTRY_TSDB_OPTIONS`` values in your configuration:

.. code-block:: python

    SENTRY_TSDB = 'sentry.tsdb.dummy.DummyTSDB'


The Redis Backend
-----------------

Configuration is fairly straight forward:

.. code-block:: python

    SENTRY_TSDB = 'sentry.tsdb.redis.RedisTSDB'

By default, this will use the ``default`` named Redis cluster. To use a
different cluster, provide the ``cluster`` option, as such:

.. code-block:: python

    SENTRY_TSDB_OPTIONS = {
        'cluster': 'tsdb',
    }


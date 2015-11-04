Internal Metrics
=================

Sentry provides an abstraction called 'metrics' which is used for
internal monitoring, generally timings and various counters.

The default backend simply discards them (though some values are still kept
in the internal time series database).

Statsd Backend
--------------

.. code-block:: python

    SENTRY_METRICS_BACKEND = 'sentry.metrics.statsd.StatsdMetricsBackend'
    SENTRY_METRICS_OPTIONS = {
        'host': 'localhost',
        'port': 8125,
    }


Datadog Backend
---------------

Datadog will require you to install the ``datadog`` package into your Sentry
environment:

.. code-block:: bash

    $ pip install datadog

.. code-block:: python

    SENTRY_METRICS_BACKEND = 'sentry.metrics.datadog.DatadogMetricsBackend'
    SENTRY_METRICS_OPTIONS = {
        'api_key': '...',
        'app_key': '...',
        'tags': {},
    }

Logging Backend
---------------

The ``LoggingBackend`` reports all operations to the ``sentry.metrics``
logger. In addition to the metric name and value, log messages also include
extra data such as the ``instance`` and ``tags`` values which can be displayed
using a custom formatter.

.. code-block:: python

    SENTRY_METRICS_BACKEND = 'sentry.metrics.logging.LoggingBackend'

    LOGGING['loggers']['sentry.metrics'] = {
        'level': 'DEBUG',
        'handlers': ['console:metrics'],
        'propagate': False,
    }

    LOGGING['formatters']['metrics'] = {
        'format': '[%(levelname)s] %(message)s; instance=%(instance)r; tags=%(tags)r',
    }

    LOGGING['handlers']['console:metrics'] = {
        'level': 'DEBUG',
        'class': 'logging.StreamHandler',
        'formatter': 'metrics',
    }

Notification Digests
====================

Sentry provides a service that will collect notifications as they occur and
schedule them for delivery as aggregated "digest" notifications.

Configuration
-------------

Although the digest system is configured with a reasonable set of default
options, the ``SENTRY_DIGESTS_OPTIONS`` setting can be used to fine-tune the
digest backend behavior to suit the needs of your unique installation. All
backends share a common set of options defined below, while some backends may
also define additional options that are specific to their individual
implementations.

.. describe:: minimum_delay

    The ``minimum_delay`` option defines the default minimum amount of time (in
    seconds) to wait between scheduling digests for delivery after the initial
    scheduling. This can be overriden on a per-project basis in the
    Notification Settings.

.. describe:: maximum_delay

    The ``maximum_delay`` option defines the default maximum amount of time (in
    seconds) to wait between scheduling digests for delivery. This can be
    overriden on a per-project basis in the Notification Settings.

.. describe:: increment_delay

    The ``increment_delay`` option defines how long each observation of an
    event should delay scheduling up until the ``maximum_delay`` after the
    last time a digest was processed.

.. describe:: capacity

    The ``capacity`` option defines the maximum number of items that should be
    contained within a timeline. Whether this is a hard or soft limit is
    backend dependent -- see the ``truncation_chance`` option.

.. describe:: truncation_chance

    The ``truncation_chance`` option defines the probability that an ``add``
    operation will trigger a truncation of the timeline to keep it's size close
    to the defined capacity. A value of 1 will cause the timeline to be
    truncated on every ``add`` operation (effectively making it a hard limit),
    while a lower probability will increase the chance of the timeline growing
    past it's intended capacity, but increases the performance of ``add``
    operations by avoiding truncation, which is a potentially expensive
    operation, especially on large data sets.

Backends
--------

Dummy Backend
~~~~~~~~~~~~~

The dummy backend disables digest scheduling, and all notifications are sent as
they occur (subject to rate limits.) This is the default digest backend for
installations that were created prior to version 8.

The dummy backend can be specified via the ``SENTRY_DIGESTS`` setting:

.. code-block:: python

    SENTRY_DIGESTS = 'sentry.digests.backends.dummy.DummyBackend'

Redis Backend
~~~~~~~~~~~~~

The Redis backend uses Redis to store schedule and pending notification data.
This is the default digest backend for installations that were created since
version 8.

The Redis backend can be specified via the ``SENTRY_DIGESTS`` setting:

.. code-block:: python

    SENTRY_DIGESTS = 'sentry.digests.backends.redis.RedisBackend'

The Redis backend accepts several options beyond the basic set, provided via
``SENTRY_DIGESTS_OPTIONS``:

.. describe:: cluster

    The ``cluster`` option defines the Redis cluster that should be used for
    storage. If no cluster is specified, the ``default`` cluster is used.

.. important::

    Changing the ``cluster`` value or the cluster configuration after data has
    been written to the digest backend may cause unexpected effects -- namely,
    it creates the potential for data loss during cluster size changes. This
    option should be adjusted with care on running systems.

.. describe:: ttl

    The ``ttl`` option defines the time-to-live (in seconds) for records,
    timelines, and digests. This can (and should) be a relatively high value,
    since timelines, digests, and records should all be deleted after they have
    been processed -- this is mainly to ensure stale data doesn't hang around
    too long in the case of a configuration error. This should be larger than
    the maximum scheduling delay to ensure data is not evicted too early.

Example Configuration
~~~~~~~~~~~~~~~~~~~~~

.. code-block:: python

    SENTRY_DIGESTS = 'sentry.digests.backends.redis.RedisBackend'
    SENTRY_DIGESTS_OPTIONS = {
        'capacity': 100,
        'cluster': 'digests',
    }

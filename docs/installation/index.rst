Installation
============

Before running Sentry itself, there are a few minimum services that are required for Sentry to communicate with.

Services
--------
* `PostgreSQL <http://www.postgresql.org/>`_

  * Docker image `postgres:9.5 <https://hub.docker.com/_/postgres/>`_
* `Redis <http://redis.io>`_ (the minimum version requirement is 2.8.9, but 2.8.18, 3.0, or newer are recommended)

  * If running Ubuntu < 15.04, you'll need to install from a different PPA.
    We recommend `chris-lea/redis-server <https://launchpad.net/~chris-lea/+archive/ubuntu/redis-server>`_
  * Docker image `redis:3.2-alpine <https://hub.docker.com/_/redis/>`_.
* A dedicated (sub)domain to host Sentry on (i.e. `sentry.yourcompany.com`).

Hardware
--------

Sentry provides a number of mechanisms to scale its capacity out
horizontally, however there is still a primary SPOF at the database level.
In an HA setup, the database is only utilized for event indexing and basic
data storage, and becomes much less of a capacity concern (see also
:doc:`../nodestore`).

We don't have any real numbers to tell you what kind of hardware you're
going to need, but we'll help you make your decision based on existing
usage from real customers.

If you're looking for an HA, and high throughput setup, you're going to
need to setup a fairly complex cluster of machines, and utilize all of
Sentry's advanced configuration options.  This means you'll need Postgres,
Riak, Redis, Memcached, and RabbitMQ.  It's very rare you'd need this
complex of a cluster, and the primary usecase for this is for the
Hosted Sentry on `sentry.io <https://sentry.io/>`_.

For more typical, but still fairly high throughput setups, you can run off
of a single machine as long as it has reasonable IO (ideally SSDs), and a
good amount of memory.

The main things you need to consider are:

- TTL on events (how long do you need to keep historical data around)
- Average event throughput
- How many events get grouped together (which means they get sampled)

At a point, sentry.io was processing approximately 4 million events a
day. A majority of this data is stored for 90 days, which accounted for
around 1.5TB of SSDs. Web and worker nodes were commodity (8GB-12GB RAM,
cheap SATA drives, 8 cores), the only two additional nodes were a
dedicated RabbitMQ and Postgres instance (both on SSDs, 12GB-24GB of
memory). In theory, given a single high-memory machine, with 16+ cores,
and SSDs, you could handle the entirety of the given data set.

Installing Sentry Server
------------------------

We support two methods of installing and running your own Sentry server.
Our recommended approach is to :doc:`use Docker <docker/index>`, but if
that's not a supported environment, you may also setup a traditional
:doc:`Python environment <python/index>`.

.. toctree::
 :maxdepth: 1

 Via Docker <docker/index>
 Via Python <python/index>

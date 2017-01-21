Node Storage
============

Sentry provides an abstraction called 'nodestore' which is used for
storing key/value blobs.

The default backend simply stores them as gzipped blobs in in the
'nodestore_node' table of your default database.

Django Backend
--------------

The Django backend stores all data in the 'nodestore_node' table, using a
the gzipped json blob-as-text pattern.

The backend provides no options, so it should simply be set to an empty
dict.

.. code-block:: python

    SENTRY_NODESTORE = 'sentry.nodestore.django.DjangoNodeStorage'
    SENTRY_NODESTORE_OPTIONS = {}


Riak Backend
------------

Riak is the recommended backend for installations which have a large data
consumption pattern, and would prefer to scale out, rather than scale up a
single SQL node.

Some notes on your Riak installation:

- You will want to the ``leveldb`` backend as blobs are larger, and
  compression helps greatly.
- Reads explicitly use ``r=1``.
- We recommend ``n=2`` for replicas, but if the data isn't extremely
  important, ``n=1`` is fine.

.. code-block:: python

    SENTRY_NODESTORE = 'sentry.nodestore.riak.RiakNodeStorage'
    SENTRY_NODESTORE_OPTIONS = {
        # specify each of your Riak nodes, or the address of your load balancer
        'nodes': [
            {'host':'127.0.0.1','http_port':8098},
        ],

        # (optional) specify an alternative bucket name
        # 'bucket': 'nodes',

        # (optional) change the default resolver
        # 'resolver': riak.resolver.last_written_resolver
    }


Cassandra Backend
-----------------

Cassandra is a horizontally scalable datastore in many of the same ways as
Riak.

The Sentry Cassandra backend only operates over the native CQL interface,
so requires Cassandra 1.2+.

.. code-block:: sql

    CREATE KEYSPACE sentry WITH replication = {
      'class': 'SimpleStrategy',
      'replication_factor': '2'
    };

    USE sentry;

    CREATE TABLE nodestore (
      key text PRIMARY KEY,
      flags int,
      value blob
    ) WITH
      compaction={'sstable_size_in_mb': '160', 'class': 'LeveledCompactionStrategy'} AND
      compression={'sstable_compression': 'SnappyCompressor'};


.. code-block:: python

    SENTRY_NODESTORE = 'sentry.nodestore.cassandra.CassandraNodeStorage'
    SENTRY_NODESTORE_OPTIONS = {
        'servers': [
            '127.0.0.1:9042',
        ],

        # (optional) specify an alternative keyspace
        # 'keyspace': 'sentry',

        # (optional) specify an alternative columnfamily
        # 'columnfamily': 'nodestore',
    }


Custom Backends
---------------

If you have a favorite data storage solution, it only has to operate under
a few rules for it to work w/ Sentry's blob storage:

- set key to value
- get key
- delete key

For more information on implementating your own backend, take a look at
``sentry.nodestore.base.NodeStorage``.

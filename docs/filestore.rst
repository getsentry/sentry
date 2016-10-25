File Storage
============

Sentry provides an abstraction called 'filestore' which is used for
storing files (such as release artifacts).

The default backend stores files on the local disk in ``/tmp/sentry-files``
which is not suitable for production use.

File System Backend
-------------------

.. code-block:: yaml

    filestore.backend: 'filesystem'
    filestore.options:
      location: '/tmp/sentry-files'


S3 Backend
----------

.. code-block:: yaml

    filestore.backend: 's3'
    filestore.options:
      access_key: '...'
      secret_key: '...'
      bucket_name: '...'

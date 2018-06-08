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


Google Cloud Storage Backend
----------

In addition to the configuration below, you'll need to make sure the shell
environment is configured with the appropriate bucket access credentials by
performing ``gcloud init`` then completing the authentication flow initiated
by a ``gcloud auth application-default login``.

.. code-block:: yaml

    filestore.backend: 'gcs'
    filestore.options:
      bucket_name: '...'


Amazon S3 Backend
----------

.. code-block:: yaml

    filestore.backend: 's3'
    filestore.options:
      access_key: '...'
      secret_key: '...'
      bucket_name: '...'

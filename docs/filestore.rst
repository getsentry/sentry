File Storage
============

Sentry provides an abstraction called 'filestore' which is used for
storing files (such as release artifacts).

The default backend stores files on the local disk in ``/tmp/sentry-files``
which is not suitable for production use.

File System Backend
-------------------

.. code-block:: python

    SENTRY_FILESTORE = 'django.core.files.storage.FileSystemStorage'
    SENTRY_FILESTORE_OPTIONS = {'location': '/tmp/sentry-files'}


S3 Backend
----------

S3 is supported through a third party library called `django-storages <https://django-storages.readthedocs.io/en/latest/>`_:

.. code-block:: bash

    $ pip install django-storages

.. code-block:: python

    SENTRY_FILESTORE = 'storages.backends.s3boto.S3BotoStorage'
    SENTRY_FILESTORE_OPTIONS = {
        'access_key': '...',
        'secret_key': '...',
        'bucket_name': '...',
    }

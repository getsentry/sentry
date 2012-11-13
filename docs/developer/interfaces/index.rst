Interfaces
==========

Sentry implements data interfaces for storing structured data. At its core, an interface describes what it's storing, and optionally how its data should be rendered.

Within the client, interfaces are referenced by their full Python module path. For example, if you were sending data
for the ``sentry.interfaces.Message`` class, it would look like this in your JSON packet::

    {
        // etc.
        "message": "Hello world"
        "sentry.interfaces.Message": {
            "message": "Hello world"
        }
    }

Provided Interfaces
-------------------

.. autoclass:: sentry.interfaces.Message

.. autoclass:: sentry.interfaces.Exception

.. autoclass:: sentry.interfaces.Stacktrace

.. autoclass:: sentry.interfaces.Template

.. autoclass:: sentry.interfaces.Http

.. autoclass:: sentry.interfaces.User

.. autoclass:: sentry.interfaces.Query

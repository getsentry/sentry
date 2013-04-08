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

Aliases
-------

As of protocol version 4, most built-in interface types are aliases for easier
reference. For example, instead of using the key 'sentry.interfaces.Exception',
you can send the key 'exception'.

The mapping is as follows::

* 'exception' => 'sentry.interfaces.Exception'
* 'request' => 'sentry.interfaces.Http'
* 'user' => 'sentry.interfaces.User'
* 'stacktrace' => 'sentry.interfaces.Stacktrace'
* 'template' => 'sentry.interfaces.Template'

Provided Interfaces
-------------------

.. autoclass:: sentry.interfaces.Message

.. autoclass:: sentry.interfaces.Exception

.. autoclass:: sentry.interfaces.Stacktrace

.. autoclass:: sentry.interfaces.Template

.. autoclass:: sentry.interfaces.Http

.. autoclass:: sentry.interfaces.User

.. autoclass:: sentry.interfaces.Query

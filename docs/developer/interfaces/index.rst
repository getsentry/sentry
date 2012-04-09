Interfaces
==========

Sentry implements data interfaces for storing structured data. At it's core, an interface describes what it's storing, and optionally how it's data should be rendered.

Bundled Interfaces
------------------

.. class:: sentry.interfaces.Message

    A standard message consisting of a ``message`` arg, and an optional
    ``params`` arg for formatting.

    If your message cannot be parameterized, then the message interface
    will serve no benefit.

    ::

        {
            "message": "My raw message with interpreted strings like %s",
            "params": ["this"]
        }

.. class:: sentry.interfaces.Exception

    A standard exception with mandatory ``type`` and ``value`` arguments, and an optional
    ``module`` argument describing the exception type's module namespace.

    ::

        {
            "type": "ValueError",
            "value": "My exception value",
            "module": "__builtins__"
        }

.. class:: sentry.interfaces.Stacktrace

    A stacktrace contains a list of frames, each with various bits (most optional)
    describing the context of that frame.

    The stacktrace contains one element, ``frames``, which is a list of hashes. Each
    hash must contain **at least** ``filename`` and ``lineno``. The rest of the values
    are optional.

    ::

        {
            "frames": [{
                "abs_path": "/real/file/name.py"
                "filename": "file/name.py",
                "function": "myfunction",
                "vars": {
                    "key": "value"
                },
                "pre_context": [
                    "line1",
                    "line2"
                ],
                "context_line": "line3",
                "lineno": 3,
                "post_context": [
                    "line4",
                    "line5"
                ],
            }]
        }


.. class:: sentry.interfaces.Template

    A rendered template (generally used like a frame in a stacktrace).

    ::

        {
            "abs_path": "/real/file/name.html"
            "filename": "file/name.html",
            "pre_context": [
                "line1",
                "line2"
            ],
            "context_line": "line3",
            "lineno": 3,
            "post_context": [
                "line4",
                "line5"
            ],
        }


.. class:: sentry.interfaces.Http

    The Request information is stored in the Http interface. Two arguments
    are required: ``url`` and ``method``.

    The ``env`` variable is a compounded dictionary of HTTP headers as well
    as environment information passed from the webserver.

    The ``data`` variable should only contain the request body (not the query
    string). It can either be a dictionary (for standard HTTP requests) or a
    raw request body.

    ::

        {
            "url": "http://absolute.uri/foo",
            "method": "POST',
            "data": {
                "foo": "bar"
            },
            "query_string": "hello=world",
            "cookies": "foo=bar",
            "headers": {
                "Content-Type": "text/html"
            },
            "env": {
                "REMOTE_ADDR": "192.168.0.1"
            }

        }

.. class:: sentry.interfaces.User

    An interface which describes the authenticated User for a request.

    All data is arbitrary, but a couple of fields are expected: ``id``
    and ``is_authenticated`` (a boolean).

    ::

        {
            "is_authenticated": true,
            "id": "unique_id",
            "username": "foo",
            "email": "foo@example.com"
        }


.. class:: sentry.interfaces.Query

    A SQL query with an optional string describing the SQL driver, ``engine``.

    ::

        {
            "query": "SELECT 1"
            "engine": "psycopg2"
        }

Writing an Interface
--------------------

TODO

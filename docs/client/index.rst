Clients
=======

Recognized Clients
------------------

The following clients are officially recognized and support the current Sentry protocol:

* Python (`Raven <http://github.com/dcramer/raven>`_)
* PHP (`raven-php <http://github.com/getsentry/raven-php>`_)

Writing a Client
----------------

For an example client, you may want to take a look at `Raven <http://github.com/dcramer/raven>`_.

This section describes how to write a Sentry client.  As far as the
writer is concerned, a Sentry client *is* a logging handler written in
a language different than Python.  You will not find the
implementation details of a specific Sentry logging handler, since these are
language dependent, but a description of the steps that are needed to
implement just a Sentry client in your own language or framework.

In general, the action taken by a logging handler compatible with
``log4j`` and ``logging`` is doing something with a timestamped
attributable formatted logging record.  Every logging record has its
own severity level.

:timestamped: ``timestamp`` is the time the event happened.
:attributable: ``logger`` is the name of the logger that produced the record.
:formatted: The finalized message of the action, stored as ``message``.
:severity level: ``level`` is a numeric value, corresponding to the ``logging`` levels.

On top of these, Sentry suggests the logger report the ``view``,
the name of the function that has caused the logging record.

Authentication
~~~~~~~~~~~~~~

A logging handler integrating with Sentry sends the records it handles
to the Sentry server.  The server listens for JSON POST requests,
with the following structure::

    POST /store/
    <the encoded record>

You must also send along the following authentication headers::

    X-Sentry-Auth: Sentry sentry_version=2.0,
    sentry_signature=<hmac signature>,
    sentry_timestamp=<signature timestamp>[,
    sentry_key=<public api key>,[
    sentry_version=<client version, arbitrary>]]

The header is composed of a SHA1-signed HMAC, the timestamp from when the message
was generated, and an arbitrary client version string. The client version should
be something distinct to your client, and is simply for reporting purposes.

To generate the HMAC signature, take the following example (in Python)::

    hmac.new(SENTRY_KEY, '%s %s' % (timestamp, message), hashlib.sha1).hexdigest()

If you are using project auth, you should sign with your project-specific ``secret_key``
instead of the global superuser key. If you are signing with your secret key, you will
also need to ensure you're provided your ``public_key`` as ``sentry_key`` in the
auth header.

The variables which are required within the signing of the message consist of the following:

- ``key`` is either the ``public_key`` or the shared global key between client and server.
- ``timestamp`` is the timestamp of which this message was generated
- ``message`` is the encoded :ref:`POST Body`

POST Body
~~~~~~~~~

The body of the post is a string representation of a JSON object and is
(optionally and preferably) gzipped and then (necessarily) base64
encoded.

The following attributes are required for all events:

.. data:: event_id

    Hexadecimal string representing a uuid4 value.

    ::

        {
            "event_id": "fc6d8c0c43fc4630ad850ee518f1b9d0"
        }

.. data:: message

    User-readable representation of this event

    ::

        {
            "message": "SyntaxError: Wattttt!"
        }

.. data:: timestamp

    Indicates when the logging record was created (in the Sentry client).

    Defaults to the ``datetime.datetime.utcnow()``

    The Sentry server assumes the time is in UTC.

    The timestamp should be in ISO 8601 format, without a timezone.

    ::

        {
            "timestamp": "2011-05-02T17:41:36"
        }

.. data:: level

    The record severity.

    Defaults to ``logging.ERROR``.

    The value can either be the integar value or the string label
    as specified in ``SENTRY_LOG_LEVELS``.

    ::

        {
            "level": "warn"
        }

.. data:: logger

    The name of the logger which logger created the record.

    If missing, defaults to the string ``root``.

    ::

        {
            "logger": "my.logger.name"
        }

Additionally, there are several optional values which Sentry recognizes:

.. data:: culprit

    Function call which was the primary perpetrator of this event.

    ::

        {
            "culprit": "my.module.function_name"
        }

.. data:: server_name

    Identifies the host client from which the event was recorded.

    ::

        {
            "server_name": "foo.example.com"
        }

.. data:: url

    The full HTTP URI from which the event was recorded.

    ::

        {
            "url": "http://example.com/path"
        }

.. data:: site

    An arbitrary value for per-site aggregation.

    ::

        {
            "site": "My Site"
        }

.. data:: modules

    A list of relevant modules and their versions.

    ::

        {
            "modules": [
                ["my.module.name", "1.0"]
            ]
        }

.. data:: extra

    An arbitrary mapping of additional metadata to store with the event.

    ::

        {
            "extra": {
                "my_key": 1,
                "some_other_value": "foo bar"
            }
        }

Any additional value is assumed to be a data interface, where the key is the Python path to the interface
class name, and the value is the data expected by the interface.

For example, with an included Exception event, a basic JSON body might resemble the following::

        {
            "event_id": "fc6d8c0c43fc4630ad850ee518f1b9d0",
            "culprit": "my.module.function_name",
            "timestamp": "2011-05-02T17:41:36",
            "message": "SyntaxError: Wattttt!"
            "sentry.interfaces.Exception": {
                "type": "SyntaxError":
                "value": "Wattttt!",
                "module": "__builtins__"
            }
        }

.. seealso::

   See :doc:`../interfaces/index` for information on Sentry's builtin interfaces and how to create your own.

Writing a Client
================

A client at its core is simply a set of utilities for capturing various
logging parameters. Given these parameters, it then builds a JSON payload
which it will send to a Sentry server using some sort of authentication
method.

Generally, a client consists of three steps to the end user, which should look
almost identical no matter the language:

1. Creation of the client (sometimes this is hidden to the user)

  ::

      var myClient = new RavenClient('http://public_key:secret_key@example.com/default');

2. Capturing an event

  ::

      var $resultId = myClient->captureException($myException);

3. Using the result of an event capture

  ::

      println('Your exception was recorded as %s', $resultId);

The constructor ideally allows several configuration methods. The first argument should
always be the DSN value (if possible), followed by an optional secondary argument which is
a map of options::

    client = new RavenClient('http://public_key:secret_key@example.com/default', {
        'tags': {'foo': 'bar'}
    })

.. note:: If an empty DSN is passed, you should treat it as valid option which signifies disabling the client.

Which options you support is up to you, but ideally you would provide defaults for generic values
that can be passed to the capture methods.

Once you accept the options, you should output a logging message describing whether the client has been configured
actively (as in, it will send to the remote server), or if it has been disabled. This should be done with whatever
standard logging module is available for your platform.

Additionally, you should provide methods (depending on the platform) which allow for capturing of a basic message and
an exception-type:

* RavenClient::captureMessage(string $message)
* RavenClient::captureException(exception $exception)

The above methods should also allow optional arguments (or a map of arguments). For example::

    client.captureException(myException, {
        'tags': {'foo': 'bar'},
    })

If your platform supports block statements, it is recommend you provide something
like the following::

    with client.captureExceptions(tags={'foo': 'bar'}):
        # do something that will cause an error
        1 / 0

.. note:: In the above example, we're passing any options that would normally be passed to the capture methods along with
          the block wrapper.

Parsing the DSN
---------------

Clients are encouraged to allow arbitrary options via the constructor, but must
allow the first argument as a DSN string. This string contains the following bits:

::

    '{PROTOCOL}://{PUBLIC_KEY}:{SECRET_KEY}@{HOST}/{PATH}{PROJECT_ID}'

For example, given the following constructor::

    new RavenClient('https://public:secret@example.com/sentry/default')

You should parse the following settings:

* URI = 'https://example.com/sentry/''
* Public Key = 'public'
* Secret Key = 'secret'
* Project ID = 'default'

If any of these values are not present, the client should notify the user immediately
that they've misconfigured the client.

The protocol value may also include a transport option. For example, in the Python client several
transports are available on top of HTTP:

* ``gevent+http``
* ``threaded+http``
* ``zmq+http``

Building the JSON Packet
------------------------

The body of the post is a string representation of a JSON object. It is also preferably gzipped encoding,
which also means its expected to be base64-encoded.

For example, with an included Exception event, a basic JSON body might resemble the following::

        {
            "event_id": "fc6d8c0c43fc4630ad850ee518f1b9d0",
            "project": "default",
            "culprit": "my.module.function_name",
            "timestamp": "2011-05-02T17:41:36",
            "message": "SyntaxError: Wattttt!",
            "tags": {
                "ios_version": "4.0"
            },
            "sentry.interfaces.Exception": {
                "type": "SyntaxError":
                "value": "Wattttt!",
                "module": "__builtins__"
            }
        }

The following attributes are required for all events:

.. data:: project

    String value representing the project

    ::

        {
            "project": "default"
        }

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

    Defaults to ``datetime.datetime.utcnow()``

    The Sentry server assumes the time is in UTC.

    The timestamp should be in ISO 8601 format, without a timezone.

    ::

        {
            "timestamp": "2011-05-02T17:41:36"
        }

.. data:: level

    The record severity.

    Defaults to ``error``.

    The value can either be the integer value or the string label
    as specified in ``SENTRY_LOG_LEVELS``.

    ::

        {
            "level": "warning"
        }

    Acceptable values are:

    * fatal
    * error
    * warning
    * info
    * debug

.. data:: logger

    The name of the logger which created the record.

    If missing, defaults to the string ``root``.

    ::

        {
            "logger": "my.logger.name"
        }

Additionally, there are several optional values which Sentry recognizes and are
highly encouraged:

.. data:: culprit

    Function call which was the primary perpetrator of this event.

    ::

        {
            "culprit": "my.module.function_name"
        }

.. data:: tags

    A map or list of tags for this event.

    ::

        {
            "tags": {
                "ios_version": "4.0",
                "context": "production"
            }
        }

    ::

        {
            "tags": [
                ["ios_version", "4.0"],
                ["context", "production"]
            ]
        }

.. data:: server_name

    Identifies the host client from which the event was recorded.

    ::

        {
            "server_name": "foo.example.com"
        }

.. data:: modules

    A list of relevant modules and their versions.

    ::

        {
            "modules": [
                {
                    "my.module.name": "1.0"
                }
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
class name, and the value is the data expected by the interface. Interfaces are used in a variety of ways
including storing stacktraces, HTTP request information, and other metadata.

See :doc:`../interfaces/index` for information on Sentry's builtin interfaces and how to create your own.

Authentication
--------------

An authentication header is expected to be sent along with the message body, which acts as as an ownership identifier::

    X-Sentry-Auth: Sentry sentry_version=2.0,
    sentry_client=<client version, arbitrary>,
    sentry_timestamp=<current timestamp>,
    sentry_key=<public api key>

.. note:: You should include the client version string in the User-Agent portion of the header, and it will be used if
          sentry_client is not sent in the auth header.

.. data:: sentry_version

    The protocol version. This should be sent as the value '2.0'.

.. data:: sentry_client

    An arbitrary string which identifies your client, including its version.

    For example, the Python client might send this as 'raven-python/1.0'

    This should be included in your User-Agent header rather than here if you're using the HTTP protocol.

.. data:: sentry_timestamp

    The unix timestamp representing the time at which this POST request was generated.

.. data:: sentry_key

    The public key which should be provided as part of the client configuration


A Working Example
-----------------

When all is said and done, you should be sending an HTTP POST request to a Sentry webserver, where
the path is the BASE_URI/api/store/. So given the following DSN::

    https://b70a31b3510c4cf793964a185cfe1fd0:b7d80b520139450f903720eb7991bf3d@example.com/1

The request body should then somewhat resemble the following::

    POST /api/store/
    User-Agent: raven-python/1.0
    X-Sentry-Auth: Sentry sentry_version=2.0, sentry_timestamp=1329096377,
        sentry_key=b70a31b3510c4cf793964a185cfe1fd0, sentry_client=raven-python/1.0

    {
        "project": "default",
        "event_id": "fc6d8c0c43fc4630ad850ee518f1b9d0",
        "culprit": "my.module.function_name",
        "timestamp": "2011-05-02T17:41:36",
        "message": "SyntaxError: Wattttt!",
        "sentry.interfaces.Exception": {
            "type": "SyntaxError",
            "value": "Wattttt!",
            "module": "__builtins__"
        }
    }

Handling Failures
-----------------

It is **highly encouraged** that your client handles failures from the Sentry server gracefully. This means taking
care of several key things:

* Soft failures when the Sentry server fails to respond in a reasonable amount of time (e.g. 3s)
* Exponential backoff when Sentry fails (don't continue trying if the server is offline)
* Failover to a standard logging module on errors.

For example, the Python client will log any failed requests to the Sentry server to a named logger, ``sentry.errors``. 
It will also only retry every few seconds, based on how many consecutive failures its seen. The code for this is simple::

    def should_try(self):
        if self.status == self.ONLINE:
            return True

        interval = min(self.retry_number, 6) ** 2

        if time.time() - self.last_check > interval:
            return True

        return False

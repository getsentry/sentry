Extending Sentry
================

There are several interfaces currently available to extend Sentry. These are a work in
progress and the API is not frozen.

Bundled Plugins
---------------

Sentry includes several plugins by default. To enable a plugin, it's as simple as adding it to
your ``INSTALLED_APPS``::

	INSTALLED_APPS = [
	  ...
	  'sentry.plugins.sentry_servers',
	  'sentry.plugins.sentry_sites',
	  'sentry.plugins.sentry_urls',
	]

sentry.plugins.sentry_server
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Enables a list of most seen servers in the message details sidebar, as well
as a dedicated panel to view all servers a message has been seen on.

::

	INSTALLED_APPS = [
	  'sentry.plugins.sentry_servers',
	]

sentry.plugins.sentry_urls
~~~~~~~~~~~~~~~~~~~~~~~~~~

Enables a list of most seen urls in the message details sidebar, as well
as a dedicated panel to view all urls a message has been seen on.

::

	INSTALLED_APPS = [
	  'sentry.plugins.sentry_urls',
	]

sentry.plugins.sentry_sites
~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. versionadded:: 1.3.13

Enables a list of most seen sites in the message details sidebar, as well
as a dedicated panel to view all sites a message has been seen on.

::

	INSTALLED_APPS = [
	  'sentry.plugins.sentry_sites',
	]

Writing a Plugin
----------------

*The plugin interface is a work in progress and the API is not frozen.**

More and better docs coming soon.

.. note::

   If you write a plugin be prepared to maintain it until we're content with the API.

Writing a Client
----------------

*work in progress!*

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

POST request
~~~~~~~~~~~~

A logging handler integrating with Sentry sends the records it handles
to the Sentry server.  The server listens for JSON POST requests,
with the following structure::

    POST /store/
    format=json
    key=<client id>
    authentication=<hmac value>
    timestamp=<authenticated timestamp>
    data=<encoded record>

If the Sentry server doesn't expect authentication, 
the two fields ``authentication`` and ``timestamp`` are not consumed and may be missing,
while the ``key`` is itself a shared secret key between client and server.  
In this case the shared secret key
travels unencrypted in the POST request so make sure the client server
connection is not sniffable or that you are not doing serious work.

Authentication
^^^^^^^^^^^^^^

If the Sentry server is configured to require authentication, 
the POST field ``key`` is a name used to identify the client 
and correspondingly ``ssk``, the shared secret key between client and server.  
In this case the shared secret key does not travel in the POST.

<<<<<<< HEAD
The authentication mechanism provided 
works on the bases of hmac (Hash based Message Authentication Code) where ``sha1`` is the hash function.  
The text being authenticated is 
the concatenated values for the ``timestamp`` and ``data`` fields in the POST.  
=======
The header is composed of a SHA1-signed HMAC, the timestamp from when the message
was generated, and an arbitrary client version string. The client version should
be something distinct to your client, and is simply for reporting purposes.

To generate the HMAC signature, take the following example (in Python)::
>>>>>>> fe47e4dbb7d2bb9a913d950ddf1787cf94b49dbe

A Python client could generate the authentication code value using the ``hashlib`` and ``hmac`` libraries::

<<<<<<< HEAD
    hmac_value = hmac.new(<ssk>, '%s%s' % (<authenticated timestamp>, <encoded record>), hashlib.sha1).hexdigest()

A POST fails authentication in any of the following conditions

    * the ``timestamp`` field is missing.
    * out of date (the ``timestamp`` lies more than 10" in the past) (configuration item).
    * repeated (an equal message was already received).
    * hmac mismatch (the ``authentication`` received does not match the one computed).

If a POST fails authentication, it is (more or less silently) dropped.
=======
The variables which are required within the signing of the message consist of the following:

- The ``SENTRY_KEY`` is a the shared secret key between client and server.
- ``timestamp`` is the timestamp of which this message was generated
- ``message`` is the encoded :ref:`POST Body`
>>>>>>> fe47e4dbb7d2bb9a913d950ddf1787cf94b49dbe

POST Body
~~~~~~~~~

The ``data`` field (the body of the post) is a string representation of a JSON object and is
(optionally and preferably) gzipped and then (necessarily) base64
encoded.

This JSON object contains the following fields:

    :``message``: the text of the formatted logging record.
    :``timestamp``: indicates when the logging record was created (in the Sentry client).  The Sentry server assumes the time is in UTC.
                    The timestamp should be in ISO 8601 format, without a timezone. For example: 2011-05-02T17:41:36
    :``level``: the record severity.
    :``message_id``: hexadecimal string representing a uuid4 value.
    :``logger``: which logger created the record.  If missing, defaults to the string ``root``, not to the root logger.
    :``view``: function call which was the primary perpetrator.
    :``server_name``: optional, identifies the Sentry client from which the record comes.
    :``url``: optional.
    :``site``: optional, makes sense if you use sites.
    :``data``: a further JSON hash containing optional metadata and some Sentry magic. (to avoid confusion, it would be nice to call this field ``metadata``).

Some of the above fields (``server_name``, ``url``, ``site``) are
optional and actually a legacy of the first Sentry client, a
Django application. They may eventually be moved to the ``metadata`` field.

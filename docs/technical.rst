Integration with Sentry
=======================

This page describes various internals of Sentry, as well as the client's storage API.

API
---

If you wish to access Sentry within your own views and models, you may do so via the standard model API::

	from sentry.models import Message, GroupedMessage
	
	# Pull the last 10 unresolved errors.
	GroupedMessage.objects.filter(status=0).order_by('-last_seen')[0:10]

You can also record errors outside of handler if you want::

	from sentry.client.models import client
	
	try:
	    ...
	except Exception, exc:
	    message_id = client.create_from_exception([exc_info=None, url=None, view=None])

If you wish to log normal messages (useful for non-``logging`` integration)::

	from sentry.client.models import client
	import logging
	
	message_id = client.create_from_text('Message Message'[, level=logging.WARNING, url=None])

Both the ``url`` and ``level`` parameters are optional. ``level`` should be one of the following:

* ``logging.DEBUG``
* ``logging.INFO``
* ``logging.WARNING``
* ``logging.ERROR``
* ``logging.FATAL``

If you have a custom exception class, similar to Http404, or something else you don't want to log,
you can also add ``skip_sentry = True`` to your exception class or instance, and Sentry will simply ignore
the error.

Writing a sentry client
-----------------------

*work in progress!*

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

:timestamped: ``timestamp`` is the time when the logging record has been produced.
:attributable: ``logger``, the name of the logger that produced the record.
:formatted: the logger has combined all logging record properties into one string: the logging ``message``.
:severity level: ``level`` is a numeric property.

On top of these, Sentry requires the logger to report the ``view``,
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

The authentication mechanism provided 
works on the bases of hmac (Hash based Message Authentication Code) where ``sha1`` is the hash function.  
The text being authenticated is 
the concatenated values for the ``timestamp`` and ``data`` fields in the POST.  

A Python client could generate the authentication code value using the ``hashlib`` and ``hmac`` libraries::

    hmac_value = hmac.new(<ssk>, '%s%s' % (<authenticated timestamp>, <encoded record>), hashlib.sha1).hexdigest()

A POST fails authentication in any of the following conditions

    * the ``timestamp`` field is missing.
    * out of date (the ``timestamp`` lies more than 10" in the past) (configuration item).
    * repeated (an equal message was already received).
    * hmac mismatch (the ``authentication`` received does not match the one computed).

If a POST fails authentication, it is (more or less silently) dropped.

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

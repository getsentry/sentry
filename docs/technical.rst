Integration with Sentry
=======================

this page is relevant for you if you want to write a sentry client or
if you simply want to understand what is going on under the hoods.

API
---

If you wish to access sentry within your own views and models, you may do so via the standard model API::

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
you can also add ``skip_sentry = True`` to your exception class or instance, and sentry will simply ignore
the error.

Writing a sentry client
-----------------------

*work in progress!*

This section describes how to write a sentry client.  As far as the
writer is concerned, a sentry client *is* a logging handler written in
a language different than Python.  you will not find the
implementation details of the sentry logging handler, since these are
language dependent, but a description of the steps that are needed to
implement just any sentry logging handler.

In general, the action taken by a logging handler compatible with
``log4j`` and ``logging`` is doing something with a timestamped
attributable formatted logging record.  Every logging record has its
own severity level.  

:timestamped: ``timestamp`` is the time when the logging record has been produced.  sentry assumes there is no delay between producing in the client and receiving in the server.  the timestamp is generated in the server when the record arrives.
:attributable: ``logger``, the name of the logger that produced the record.
:formatted: the logger has combined all logging record properties into one string: the logging ``message``.
:severity level: ``level`` is a numeric property.

on top of these, sentry requires the logger to report the ``view``,
the name of the function that has caused the logging record.

A logging handler integrating with sentry sends the records it handles
to a sentry server.  The sentry server listens to JSON POST requests,
the structure of the request is:

::

 POST /store/
 key=SENTRY_KEY
 format=json
 data=<the encoded record>

the ``data`` is the string representation of a JSON object and is
(optionally and preferably) gzipped and then (necessarily) base64
encoded.

This ``data`` JSON object contains the following fields:

 :``level``: the record severity.
 :``message``: will specify the entire message body
 :``view``: function call which was the primary perpetrator
 :``message_id``: a uuid4 hex value
 :``logger``: optional, defaults to the empty string (the root).
 :``server_name``: optional, **please document this**.
 :``url``: optional.
 :``site``: only if you use sites
 :``data``: a further JSON hash containing optional metadata and some sentry magic. (to avoid confusion, it would be nice to call this field ``metadata``).

some of the above fields (``server_name``, ``url``, ``site``) are
optional and actually a legacy of the first sentry client, a
django application.  they might be moved to the ``metadata`` field.

Extending Sentry
================

There are several interfaces currently available to extend Sentry. These are a work in
progress and the API is not frozen.

.. note::

   If you write a plugin be prepared to maintain it until we're content with the API.

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

Servers
*******

Enables a list of most seen servers in the message details sidebar, as well
as a dedicated panel to view all servers a message has been seen on.

::

	INSTALLED_APPS = [
	  'sentry.plugins.sentry_servers',
	]

URLs
****

Enables a list of most seen urls in the message details sidebar, as well
as a dedicated panel to view all urls a message has been seen on.

::

	INSTALLED_APPS = [
	  'sentry.plugins.sentry_urls',
	]

Sites
*****

.. versionadded:: 1.3.13

Enables a list of most seen sites in the message details sidebar, as well
as a dedicated panel to view all sites a message has been seen on.

::

	INSTALLED_APPS = [
	  'sentry.plugins.sentry_sites',
	]

Building Plugins
----------------

*The plugin interface is a work in progress and the API is not frozen.**

More and better docs coming soon.

API
---

For the technical, here's some further docs:

If you wish to access these within your own views and models, you may do so via the standard model API::

	from sentry.models import Message, GroupedMessage
	
	# Pull the last 10 unresolved errors.
	GroupedMessage.objects.filter(status=0).order_by('-last_seen')[0:10]

You can also record errors outside of handler if you want::

	from sentry.client.base import SentryClient
	
	try:
		...
	except Exception, exc:
		SentryClient().create_from_exception([exc_info=None, url=None, view=None])

If you wish to log normal messages (useful for non-``logging`` integration)::

	from sentry.client.base import SentryClient
	import logging
	
	SentryClient().create_from_text('Message Message'[, level=logging.WARNING, url=None])

Both the ``url`` and ``level`` parameters are optional. ``level`` should be one of the following:

* ``logging.DEBUG``
* ``logging.INFO``
* ``logging.WARNING``
* ``logging.ERROR``
* ``logging.FATAL``

If you have a custom exception class, similar to Http404, or something else you don't want to log,
you can also add ``skip_sentry = True`` to your exception class or instance, and sentry will simply ignore
the error.
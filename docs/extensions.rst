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


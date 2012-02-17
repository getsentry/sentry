Plugins
=======

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

.. data:: sentry.plugins.sentry_server
    :noindex:

    Enables a list of most seen servers in the message details sidebar, as well
    as a dedicated panel to view all servers a message has been seen on.

    ::

        INSTALLED_APPS = [
          'sentry.plugins.sentry_servers',
        ]

.. data:: sentry.plugins.sentry_urls
    :noindex:

    Enables a list of most seen urls in the message details sidebar, as well
    as a dedicated panel to view all urls a message has been seen on.

    ::

        INSTALLED_APPS = [
          'sentry.plugins.sentry_urls',
        ]

.. data:: sentry.plugins.sentry_sites
    :noindex:

    .. versionadded:: 1.3.13

    Enables a list of most seen sites in the message details sidebar, as well
    as a dedicated panel to view all sites a message has been seen on.

    ::

        INSTALLED_APPS = [
          'sentry.plugins.sentry_sites',
        ]

Recognized 3rd Party Extensions
-------------------------------

The extensions are officially recognized and support the current Sentry protocol:

* `sentry-phabricator <https://github.com/dcramer/sentry-phabricator>`_

Have an extension that should be listed here? Submit a `pull request <https://github.com/dcramer/sentry>`_ and we'll
get it added.
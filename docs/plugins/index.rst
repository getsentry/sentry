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
      'sentry.plugins.sentry_mail',
      'sentry.plugins.sentry_servers',
      'sentry.plugins.sentry_sites',
      'sentry.plugins.sentry_urls',
      'sentry.plugins.sentry_useragents',
    ]

.. data:: sentry.plugins.sentry_server
    :noindex:

    Enables a list of most seen servers in the message details sidebar, as well
    as a dedicated panel to view all servers a message has been seen on.

.. data:: sentry.plugins.sentry_urls
    :noindex:

    Enables a list of most seen urls in the message details sidebar, as well
    as a dedicated panel to view all urls a message has been seen on.

.. data:: sentry.plugins.sentry_sites
    :noindex:

    .. versionadded:: 1.3.13

    Enables a list of most seen sites in the message details sidebar, as well
    as a dedicated panel to view all sites a message has been seen on.

.. data:: sentry.plugins.sentry_mail
    :noindex:

    Enables email notifications when new events or regressions happen.

.. data:: sentry.plugins.sentry_useragents
    :noindex:

    Enables tagging of browsers and operating systems based on the
    'User-Agent' header in the HTTP interface.

    .. versionadded:: 4.5.0

3rd Party Extensions
--------------------

The following extensions are available and maintained by members of the Sentry community:

* `sentry-campfire <https://github.com/mkhattab/sentry-campfire>`_
* `sentry-github <https://github.com/getsentry/sentry-github>`_
* `sentry-groveio <https://github.com/mattrobenolt/sentry-groveio>`_
* `sentry-hipchat <https://github.com/linovia/sentry-hipchat>`_
* `sentry-irc <https://github.com/gisce/sentry-irc>`_
* `sentry-jira <https://github.com/thurloat/sentry-jira>`_
* `sentry-phabricator <https://github.com/getsentry/sentry-phabricator>`_
* `sentry-pushover <https://github.com/dz0ny/sentry-pushover>`_
* `sentry-trello <https://github.com/DamianZaremba/sentry-trello>`_

Have an extension that should be listed here? Submit a `pull request <https://github.com/getsentry/sentry>`_ and we'll
get it added.
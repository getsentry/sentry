Plugins
=======

There are several interfaces currently available to extend Sentry. These
are a work in progress and the API is not frozen.

Bundled Plugins
---------------

Sentry includes several plugins by default. Builtin plugins are controlled via the
``INSTALLED_APPS`` Django setting::

    INSTALLED_APPS = [
      ...
      'sentry.plugins.sentry_mail',
      'sentry.plugins.sentry_urls',
      'sentry.plugins.sentry_useragents',
    ]

.. describe:: sentry.plugins.sentry_urls

    Enables auto tagging of urls based on the Http interface contents.

.. describe:: sentry.plugins.sentry_mail

    Enables email notifications when new events or regressions happen.

.. describe:: sentry.plugins.sentry_useragents

    Enables auto tagging of browsers and operating systems based on the
    'User-Agent' header in the HTTP interface.

    .. versionadded:: 4.5.0

3rd Party Extensions
--------------------

The following extensions are available and maintained by members of the Sentry community:

* `sentry-bitbucket <https://github.com/neilalbrock/sentry-bitbucket>`_
* `sentry-campfire <https://github.com/mkhattab/sentry-campfire>`_
* `sentry-flowdock <https://github.com/getsentry/sentry-flowdock>`_
* `sentry-fogbugz <https://github.com/glasslion/sentry-fogbugz>`_
* `sentry-github <https://github.com/getsentry/sentry-github>`_
* `sentry-groveio <https://github.com/mattrobenolt/sentry-groveio>`_
* `sentry-hipchat <https://github.com/linovia/sentry-hipchat>`_
* `sentry-irc <https://github.com/gisce/sentry-irc>`_
* `sentry-irccat <https://github.com/russss/sentry-irccat>`_
* `sentry-jira <https://github.com/thurloat/sentry-jira>`_
* `sentry-lighthouse <https://github.com/gthb/sentry-lighthouse>`_
* `sentry-notifico <https://github.com/lukegb/sentry-notifico>`_
* `sentry-phabricator <https://github.com/getsentry/sentry-phabricator>`_
* `sentry-pivotal <https://github.com/getsentry/sentry-pivotal>`_
* `sentry-pushover <https://github.com/getsentry/sentry-pushover>`_
* `sentry-searchbutton <https://github.com/timmyomahony/sentry-searchbutton>`_
* `sentry-sprintly <https://github.com/mattrobenolt/sentry-sprintly>`_
* `sentry-statsd <https://github.com/dreadatour/sentry-statsd>`_
* `sentry-teamwork <https://github.com/getsentry/sentry-teamwork>`_
* `sentry-top <https://github.com/getsentry/sentry-top>`_
* `sentry-trello <https://github.com/DamianZaremba/sentry-trello>`_
* `sentry-unfuddle <https://github.com/rkeilty/sentry-unfuddle>`_
* `sentry-whatsapp <https://github.com/ecarreras/sentry-whatsapp>`_
* `sentry-xmpp <https://github.com/chroto/sentry-xmpp>`_
* `sentry-youtrack <https://github.com/bogdal/sentry-youtrack>`_
* `sentry-slack <https://github.com/getsentry/sentry-slack>`_
* `sentry-zabbix <https://github.com/m0n5t3r/sentry-zabbix>`_

Have an extension that should be listed here? Submit a `pull request
<https://github.com/getsentry/sentry>`_ and we'll get it added.

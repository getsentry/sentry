Upgrading
=========

**Always upgrade the Sentry server before upgrading your clients** unless
the client states otherwise.

Upgrading Sentry simply requires you to run migrations and restart your
web services. We recommend you run the migrations from a separate install
so that they can be completed before updating the code which runs the
webserver.

Generally, you'll start by installing the upgraded Sentry package::

    easy_install -U sentry

Continue by running all required migrations, with the upgrade command::

    sentry upgrade

Finally, restart any Sentry services you had running.

Upgrading to 7.x
~~~~~~~~~~~~~~~~

An extremely large amount of changes happened between the 6.x and 7.x
series. Many of them are backwards incompatible so you should review the
setup guide again.

- Redis is now a requirement
- The queue and buffer systems are no longer optional for production systems
- Time series data (graphs) have been moved to a new system (there is no
  data migration)
- The default sentry.conf.py has greatly changed

Due to the configuration generation being greatly improved, we recommend
merging your existing settings with the new defaults. To do that just
backup your `sentry.conf.py` and generate a new one using `sentry init`.

See the Changelog for additional backwards incompatible APIs.

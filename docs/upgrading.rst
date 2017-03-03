Upgrading
=========

**Always upgrade the Sentry server before upgrading your clients** unless
the client states otherwise.

If you're upgrading to a new major release, its always recommended to start
by generating a new configuration file (using the new version of Sentry).
This will ensure that any new settings which may have been added are clearly
visible and get configured correctly.

Beyond that, upgrades are simple as bumping the version of Sentry (which
will cause any change dependencies to upgrade), running data migrations,
and restarting the all related services.

.. note:: In some cases you may want to stop services before doing the upgrade
          process between larger version ranges or you'll see intermittent errors.

Upgrading Sentry
----------------

Upgrading the Package
~~~~~~~~~~~~~~~~~~~~~

The easiest way is to upgrade the Sentry package using ``pip``::

    pip install --upgrade sentry

You may prefer to install a fixed version rather than just assuming latest,
as it will allow you to better understand what is changing.

If you're installing from source, you may have additional requirements that
are unfulfilled, so take the nessesary precautions of testing your environment
before committing to the upgrade.

Generating New Configuration
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

We recommend generating a new configuration and pulling in your old values.
While this isn't strictly required, a lot of mishaps can be avoided by
ensuring everything is configured correctly. This is especially important
when doing a large version range upgrade, or upgrading to a new major release::

    sentry init /tmp/new-sentry-conf

Running Migrations
~~~~~~~~~~~~~~~~~~

Just as during the initial setup, migrations are applied with the upgrade
command::

    sentry upgrade

Restarting Services
~~~~~~~~~~~~~~~~~~~

You'll need to ensure that *all* services running Sentry code are restarted
after an upgrade. This is important as Python loads modules in memory and
code changes will not be reflected until a restart.

These services include:

- webserver -- ``sentry run web``
- workers -- ``sentry run worker``
- cron -- ``sentry run cron``

Version Notes
-------------

Upgrading to 8.x
~~~~~~~~~~~~~~~~

As of 8.0 **MySQL is no longer supported**. While things may still function
we will no longer be providing support upstream, and schema migrations will
likely need applied by hand.

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

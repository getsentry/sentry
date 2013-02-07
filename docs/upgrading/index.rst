Upgrading
=========

**Always upgrade the Sentry server before upgrading your clients** unless
the client states otherwise.

Upgrading Sentry simply requires you to run migrations and restart your web services. We recommend
you run the migrations from a separate install so that they can be completed before updating the
code which runs the webserver.

Generally, you'll start by installing the upgraded Sentry package::

    easy_install -U sentry

Continue by running all required migrations, with the upgrade command::

    sentry upgrade

Finally, restart any Sentry services you had running.

Conflicts with kombu.transport.django
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

A recent release of Kombu (2.1.6) added support for South migrations. This means that if you had an older
version of Kombu installed, you'll need to "fake" the migrations, as they were already applied.

**You should only do this is you actually receive an error while migrating.**

To fake the migrations, run the following::

    sentry migrate kombu.transport.django 0001 --fake

Conflicts with social_auth
~~~~~~~~~~~~~~~~~~~~~~~~~~

A recent release of django-social-auth (0.7.18) added support for South migrations. This means that if you had an older
version of the package installed, you'll need to "fake" the migrations, as they were already applied.

**You should only do this is you actually receive an error while migrating.**

To fake the migrations, run the following::

    sentry migrate social_auth 0001 --fake

Upgrading from 1.x
~~~~~~~~~~~~~~~~~~

If you are upgrading Sentry from a 1.x version, you should take note that the database migrations
are much more significant than they were in the past. We recommend performing them **before**
upgrading the actual Sentry server.

This includes several new tables (such as Project), and alters on almost all existing tables. It
also means it needs to backfill the project_id column on all related tables.

You should also read over the installation guide again, as some things have likely changed.

Upgrading to >= 5.1
~~~~~~~~~~~~~~~~~~~

Version 5.1 of Sentry includes a large set of changes including a new client protocol (version 3). It is
fully compatible with version 2.0 of the protocol, but no longer supports several deprecated features, including
version 1.0.

If you're upgrading from a very old version of Sentry, you may have a lapse in data during your upgrade process.

Upgrading from <= 5.3
~~~~~~~~~~~~~~~~~~~~~

If you were previously using social auth backends, take note that the callback URLs have been moved. They are now
all prefixed with '/account/settings/social'.

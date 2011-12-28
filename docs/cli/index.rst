The Command Line
================

Sentry installs a command line script under the name ``sentry`. This will allow you to
perform most required operations that are unachievable within the web UI.

For a list of commands, you can also use ``sentry help``, or ``sentry [command] --help``
for help on a specific command.

Builtin Commands
----------------

.. data:: sentry.commands.start

    Starts all background services.

    ::

        sentry start --daemon

.. data:: sentry.commands.stop

    Stops all background services.

.. data:: sentry.commands.restart

    Restarts all background services

.. data:: sentry.commands.upgrade

    Performs any needed database migrations.

.. data:: sentry.commands.cleanup

    Performs all trim operations based on your configuration.

.. data:: sentry.commands.manage

    A wrapper around ``django-admin.py`` (aka ``manage.py``).

    ::

        sentry manage createsuperuser


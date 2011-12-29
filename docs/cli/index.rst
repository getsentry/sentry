Command Line Usage
==================

Sentry installs a command line script under the name ``sentry``. This will allow you to
perform most required operations that are unachievable within the web UI.

For a list of commands, you can also use ``sentry help``, or ``sentry [command] --help``
for help on a specific command.

Builtin Commands
----------------

.. data:: start

    Starts all background services.

    ::

        sentry start --daemon

.. data:: stop

    Stops all background services.

.. data:: upgrade

    Performs any needed database migrations.

.. data:: cleanup

    Performs all trim operations based on your configuration.

.. data:: manage

    A wrapper around ``django-admin.py`` (aka ``manage.py``).

    ::

        sentry manage createsuperuser


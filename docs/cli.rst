Command Line Usage
==================

Sentry installs a command line script under the name ``sentry``. This will
allow you to perform most required operations that are unachievable within
the web UI.

If you're using a non-standard configuration location make sure you to pass the
configuration via the ``SENTRY_CONF`` environment variable::

    SENTRY_CONF=/www/sentry/sentry.conf.py sentry help

For a list of commands, you can also use ``sentry help``, or ``sentry
[command] --help`` for help on a specific command.

Builtin Commands
----------------

.. describe:: init [config]

    Initializes the configuration file for Sentry.

    Defaults to ~/.sentry/sentry.conf.py

    ::

        sentry init /etc/sentry.conf.py

    .. note:: The init command requires you to pass the configuration
              value as the parameter whereas other commands require you
              to use --config for passing the location of this file.

.. describe:: start

    Starts the built-in Sentry webservice.

.. describe:: upgrade

    Performs any needed database migrations (or related operations).

.. describe:: createuser

    Creates a new user.

.. describe:: cleanup

    Performs all trim operations based on your configuration.

.. describe:: repair

    Performs any needed repair against the Sentry database. This will attempt to correct
    things like missing teams, project keys, etc.

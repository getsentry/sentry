Command Line Usage
==================

Sentry installs a command line script under the name ``sentry``. This will allow you to
perform most required operations that are unachievable within the web UI.

For a list of commands, you can also use ``sentry help``, or ``sentry [command] --help``
for help on a specific command.

.. note:: The script is powered by a library called `Logan <https://github.com/dcramer/logan>`_
          and simply acts as a conduit to django-admin.py.

Builtin Commands
----------------

.. data:: init [config]

    Initializes the configuration file for Sentry.

    Defaults to ~/.sentry/sentry.conf.py

    ::

        sentry init /etc/sentry.conf.py

.. data:: start [services]

    Starts a Sentry service. By default this value is 'http'.

    Other services are 'udp', for the UDP server.

    ::

        sentry start udp

.. data:: upgrade

    Performs any needed database migrations. This is similar to running
    ``django-admin.py syncdb --migrate``.

.. data:: cleanup

    Performs all trim operations based on your configuration.

.. data:: repair

    Performs any needed repair against the Sentry database. This will attempt to correct
    things like missing teams, project keys, etc.

    If you specify ``--owner`` it will also update ownerless projects::

        sentry repair --owner=<username>


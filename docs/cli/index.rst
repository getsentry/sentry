Command Line Usage
==================

Sentry installs a command line script under the name ``sentry``. This will
allow you to perform most required operations that are unachievable within
the web UI.

If you're using a non-standard configuration location make sure you to pass the
configuration via the ``SENTRY_CONF`` environment variable::

    SENTRY_CONF=/etc/sentry sentry help

For a list of commands, you can also use ``sentry help``, or ``sentry
[command] --help`` for help on a specific command.

.. include:: index.rst.inc

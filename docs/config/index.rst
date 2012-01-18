Configuration
=============

This document describes additional configuration options available to the Sentry server. If you are looking for documentation for the client, it is maintained in the `Raven <http://github.com/dcramer/raven>`_ project.

.. note:: While the options below are labeled without the ``SENTRY_`` prefix, when you are configuring them via your ``settings.py`` you **must* specify the prefix.

.. data:: sentry.conf.KEY
    :noindex:

    The shared secret for global administration privileges via the API.

    We recommend using Project API keys to maintain access, as using a shared key provides a potential security risk.

    ::

    	SENTRY_KEY = '0123456789abcde'

.. data:: sentry.conf.URL_PREFIX
    :noindex:

	Absolute URL to the sentry root directory. Should not include a trailing slash.

	Defaults to ``""``.

	::

		SENTRY_URL_PREFIX = '/sentry'

.. data:: sentry.conf.SAMPLE_DATA
    :noindex:

	.. versionadded:: 1.10.0

	Controls sampling of data.

	Defaults to ``True``.

	If this is enabled, data will be sampled in a manner similar to the following:

	* 50 messages stores ~50 results
	* 1000 messages stores ~400 results
	* 10000 messages stores ~900 results
	* 100000 messages stores ~1800 results
	* 1000000 messages stores ~3600 results
	* 10000000 messages stores ~4500 results

	::

		SENTRY_SAMPLE_DATA = False

.. data:: sentry.conf.FILTERS
    :noindex:

    A list of filters for extending the Sentry interface (as well as post-processing of data).

    ::

		SENTRY_FILTERS = (
		    'sentry.filters.StatusFilter',
		    'sentry.filters.LoggerFilter',
		    'sentry.filters.LevelFilter',
		    'sentry.filters.ServerNameFilter',
		    'sentry.filters.SiteFilter',
		)

.. data:: sentry.conf.PROCESSORS
    :noindex:

    A list of processors for acting on Sentry events.

    ::

        SENTRY_PROCESSORS = (
            'my.custom.IRCNotifier',
        )

.. data:: sentry.conf.VIEWS
    :noindex:

    A list of views for enhancing the event aggregation dashboard.

    ::

        SENTRY_VIEWS = (
            'sentry.views.Exception',
            'sentry.views.Message',
            'sentry.views.Query',
        )

.. data:: sentry.conf.LOG_LEVELS
    :noindex:

    A list of log levels, with their numeric value, as well as their short name.

    ::

        LOG_LEVELS = (
            (logging.DEBUG, 'debug'),
            (logging.INFO, 'info'),
            (logging.WARNING, 'warning'),
            (logging.ERROR, 'error'),
            (logging.FATAL, 'fatal'),
        )

Authentication
--------------

.. data:: sentry.conf.PUBLIC
    :noindex:

    Should Sentry be protected by a username and password (using @login_required) or be publicly accessible.

    Defaults to ``False`` (password protection).

    ::

        SENTRY_PUBLIC = True

.. data:: sentry.conf.ALLOW_PROJECT_CREATION
    :noindex:

    Should sentry allow users without the 'sentry.add_project' permission to
    create new projects?

    Defaults to ``False`` (require permission).

    ::

        SENTRY_ALLOW_PROJECT_CREATION = True

Notifications
-------------


.. data:: sentry.conf.ADMINS
    :noindex:

    A list of email address to send notification emails to.

    Defaults to ``[]``.

	On smaller sites you may wish to enable throttled emails, we recommend doing this by first
	removing the ``ADMINS`` setting in Django, and adding in ``SENTRY_ADMINS``::

		# Disable the default admins (for email)
		ADMINS = ()
		# Set Sentry's ADMINS to a raw list of email addresses
		SENTRY_ADMINS = ('root@localhost',)

	This will send out a notification the first time an error is seen, and the first time an error is
	seen after it has been resolved.

.. data:: sentry.conf.MAIL_LEVEL
    :noindex:

	.. versionadded:: 1.10.0

	The threshold level to restrict emails to.

	Defaults to ``logging.DEBUG``.

	::

		SENTRY_MAIL_LEVEL = logging.DEBUG

.. data:: sentry.conf.MAIL_INCLUDE_LOGGERS
    :noindex:

	.. versionadded:: 1.10.0

	An explicit list of all logger names to restrict emails to.

	Defaults to ``None``, which means to "all loggers".

	::

		SENTRY_MAIL_INCLUDE_LOGGERS = (
		  'my.custom.logger.name',
		)

.. data:: sentry.conf.MAIL_INCLUDE_LOGGERS
    :noindex:

	.. versionadded:: 1.10.0

	An explicit list of all logger names to exclude from emails.

	Defaults to ``[]``.

	::

		SENTRY_MAIL_EXCLUDE_LOGGERS = (
		  'some.annoying.logger',
		)

.. data:: sentry.conf.EMAIL_SUBJECT_PREFIX
    :noindex:

	The prefix to apply to outgoing emails.

	Defaults to ``""``.

	::

		SENTRY_EMAIL_SUBJECT_PREFIX = '[Sentry] '


.. data:: sentry.conf.SERVER_EMAIL
    :noindex:

	The reply-to email address for outgoing mail.

	Defaults to ``root@localhost``.

	::

		SENTRY_SERVER_EMAIL = 'sentry@example.com'

Web Server
----------

The following settings are available for the built-in webserver:

.. data:: sentry.conf.WEB_HOST
    :noindex:

    The hostname which the webserver should bind to.

    Defaults to ``localhost``.

    ::

        SENTRY_WEB_HOST = '0.0.0.0'  # bind to all addresses

.. data:: sentry.conf.WEB_PORT
    :noindex:

    The port which the webserver should listen on.

    Defaults to ``9000``.

    ::

        SENTRY_WEB_PORT = 9000

.. data:: sentry.conf.RUN_DIR
    :noindex:

    The location to store PID files for services.

    Defaults to ``%SENTRY%/run/``.

    ::

        SENTRY_WEB_RUN_DIR = '/var/run/'

.. data:: sentry.conf.WEB_LOG_FILE
    :noindex:


    The location to store log files for services.

    Defaults to ``%SENTRY%/log/``.

    ::

        SENTRY_WEB_LOG_DIR = '/var/log/'

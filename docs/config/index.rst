Configuration
=============

This document describes additional configuration options available to the Sentry server. If you are looking for documentation for the client, it is maintained in the `Raven <http://github.com/dcramer/raven>`_ project.

.. note:: While the optiosn below are labeled without the ``SENTRY_`` prefix, when you are configuring them via your ``settings.py`` you **must* specify the prefix.

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

.. data:: sentry.conf.URL_PREFIX
    :noindex:

	Absolute URL to the sentry root directory. Should not include a trailing slash.

	Defaults to ``""``.

	::

		SENTRY_URL_PREFIX = '/sentry'

.. data:: sentry.conf.PUBLIC
    :noindex:

	Should Sentry be protected by a username and password (using @login_required) or be publicly accessible.

	Defaults to ``False`` (password protection).

	::

		SENTRY_PUBLIC = True

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
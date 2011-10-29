Configuration
=============

This document describes additional configuration options available to the Sentry server. If you are looking for documentation for the client, it is maintained in the `Raven <http://github.com/dcramer/raven>`_ project.

Integration with ``haystack`` (Search)
--------------------------------------

(This support is still under development)

Note: You will need to install a forked version of Haystack which supports additional configuration. It can be obtained on `GitHub <http://github.com/disqus/django-haystack>`_.

Start by configuring your Sentry search backend::

	SENTRY_SEARCH_ENGINE = 'solr'
	SENTRY_SEARCH_OPTIONS = {
	    'url': 'http://127.0.0.1:8983/solr'
	}

Or if you want to use Whoosh (you shouldn't)::

	SENTRY_SEARCH_ENGINE = 'whoosh'
	SENTRY_SEARCH_OPTIONS = {
	    'path': os.path.join(PROJECT_ROOT, 'sentry_index')
	}

Now ensure you've added ``haystack`` to the ``INSTALLED_APPS`` on Sentry's server::

	INSTALLED_APPS = INSTALLED_APPS + ('haystack',)

When calling Haystack's Django management commands, you'll need to identify Sentry to Haystack by explicitly including the ``--site`` parameter::

	python manage.py build_solr_schema --site=sentry.search_indexes.site

Enjoy!

Other Settings
--------------

Several options exist to configure django-sentry via your configuration module:

SENTRY_ADMINS
~~~~~~~~~~~~~

On smaller sites you may wish to enable throttled emails, we recommend doing this by first
removing the ``ADMINS`` setting in Django, and adding in ``SENTRY_ADMINS``::

	ADMINS = ()
	SENTRY_ADMINS = ('root@localhost',)

This will send out a notification the first time an error is seen, and the first time an error is
seen after it has been resolved.

SENTRY_MAIL_LEVEL
~~~~~~~~~~~~~~~~~

.. versionadded:: 1.10.0

The threshold level to restrict emails to. Defaults to ``logging.DEBUG``.

SENTRY_MAIL_INCLUDE_LOGGERS
~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. versionadded:: 1.10.0

An explicit list of all logger names to restrict emails to. Defaults to ``None``, which
translates to "all loggers".

SENTRY_MAIL_EXCLUDE_LOGGERS
~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. versionadded:: 1.10.0

An explicit list of all logger names to exclude from emails. Defaults to ``[]``.

SENTRY_URL_PREFIX
~~~~~~~~~~~~~~~~~

Absolute URL to the sentry root directory. Should not include a trailing slash. Defaults to ``""``.

SENTRY_PUBLIC
~~~~~~~~~~~~~

Should Sentry be protected by a username and password (using @login_required) or be publicly accessible. Defaults to ``False`` (password protection).

SENTRY_SAMPLE_DATA
~~~~~~~~~~~~~~~~~~

.. versionadded:: 1.10.0

Controls sampling of data. Defaults to ``True``.

If this is enabled, data will be sampled in a manner similar to the following:

* 50 messages stores ~50 results
* 1000 messages stores ~400 results
* 10000 messages stores ~900 results
* 100000 messages stores ~1800 results
* 1000000 messages stores ~3600 results
* 10000000 messages stores ~4500 results

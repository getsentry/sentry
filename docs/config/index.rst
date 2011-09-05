Configuration
=============

This document describes additional configuration options available to Sentry.

.. note:: While these are prefixed with ``SENTRY_`` in your ``settings.py``, if you were to configure or reference them via
          Sentry's internal tools the prefix would be dropped.
          
          For example, ``SENTRY_PUBLIC`` would be ``sentry.conf.settings.PUBLIC``.


Integration with ``logging``
----------------------------

Sentry supports the ability to directly tie into the ``logging`` module. To use it simply add ``SentryHandler`` to your logger.


Django 1.3
~~~~~~~~~~

::

    LOGGING = {
        'version': 1,
        'disable_existing_loggers': True,
        'handlers': {
            'sentry': {
                'level': 'DEBUG',
                'class': 'sentry.client.handlers.SentryHandler',
                'formatter': 'verbose'
            },
            'console': {
                'level': 'DEBUG',
                'class': 'logging.StreamHandler',
                'formatter': 'verbose'
            }
        },
        'loggers': {
            '()': {
                'level': 'WARNING',
                'handlers': ['sentry'],
            },
            'sentry.errors': {
                'level': 'DEBUG',
                'handlers': ['console'],
                'propagate': False,
            },
        },
    }


Older Versions
~~~~~~~~~~~~~~

::

    import logging
    from sentry.client.handlers import SentryHandler

    logger = logging.getLogger()
    # ensure we havent already registered the handler
    if SentryHandler not in map(type, logger.handlers):
        logger.addHandler(SentryHandler())

        # Add StreamHandler to sentry's default so you can catch missed exceptions
        logger = logging.getLogger('sentry.errors')
        logger.propagate = False
        logger.addHandler(logging.StreamHandler())


Usage
~~~~~

A recommended pattern in logging is to simply reference the modules name for each logger, so for example, you might at the top of your module define the following::

    import logging
    logger = logging.getLogger(__name__)

You can also use the ``exc_info`` and ``extra=dict(url=foo)`` arguments on your ``log`` methods. This will store the appropriate information and allow django-sentry to render it based on that information::

	logger.error('There was some crazy error', exc_info=True, extra={'url': request.build_absolute_uri()})

You may also pass additional information to be stored as meta information with the event. As long as the key
name is not reserved and not private (_foo) it will be displayed on the Sentry dashboard. To do this, pass it as ``data`` within
your ``extra`` clause::

	logger.error('There was some crazy error', exc_info=True, extra={
	    # Optionally pass a request and we'll grab any information we can
	    'request': request,

	    # Otherwise you can pass additional arguments to specify request info
	    'view': 'my.view.name',
	    'url': request.build_absolute_url(),

	    'data': {
	        # You may specify any values here and Sentry will log and output them
	        'username': request.user.username
	    }
	})

.. note:: The ``url`` and ``__sentry__`` keys are used internally by Sentry within the extra data.
.. note:: Any key prefixed with ``_`` will not automatically output on the Sentry details view.

Sentry will intelligently group messages if you use proper string formatting. For example, the following messages would
be seen as the same message within Sentry::

	logger.error('There was some %s error', 'crazy')
	logger.error('There was some %s error', 'fun')
	logger.error('There was some %s error', 1)

As of Sentry 1.10.0 the ``logging`` integration also allows easy capture of stack frames (and their locals) as if you were
logging an exception. This can be done automatically with the ``SENTRY_AUTO_LOG_STACKS`` setting, as well as by passing the
``stack`` boolean to ``extra``::

	logger.error('There was an error', extra={'stack': True})

.. note:: We are describing a client/server interaction where
both components are provided by django-sentry.  Other languages that
provide a logging package that is comparable to the python ``logging``
package may define a sentry handler.  Check the Integration with
Sentry `Integration with Sentry <technical.html#integration-with-sentry>`_ paragraph.

Integration with ``haystack`` (Search)
--------------------------------------

(This support is still under development)

Note: You will need to install a forked version of Haystack which supports additional configuration. It can be obtained on `GitHub <http://github.com/disqus/django-haystack>`.

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

404 Logging
-----------

.. versionadded:: 1.6.0

In certain conditions you may wish to log 404 events to the Sentry server. To do this, you simply need to enable a Django middleware::

	MIDDLEWARE_CLASSES = MIDDLEWARE_CLASSES + (
	  ...,
	  'sentry.client.middleware.Sentry404CatchMiddleware',
	)

Message References
------------------

.. versionadded:: 1.6.0

Sentry supports sending a message ID to your clients so that they can be tracked easily by your development team. There are two ways to access this information, the first is via the ``X-Sentry-ID`` HTTP response header. Adding this is as simple as appending a middleware to your stack::

	MIDDLEWARE_CLASSES = MIDDLEWARE_CLASSES + (
	  # We recommend putting this as high in the chain as possible
	  'sentry.client.middleware.SentryResponseErrorIdMiddleware',
	  ...,
	)

Another alternative method is rendering it within a template. By default, Sentry will attach request.sentry when it catches a Django exception. In our example, we will use this information to modify the default 500.html which is rendered, and show the user a case reference ID. The first step in doing this is creating a custom ``handler500`` in your ``urls.py`` file::

	from django.conf.urls.defaults import *
	
	from django.views.defaults import page_not_found, server_error
	
	def handler500(request):
	    """
	    500 error handler which includes ``request`` in the context.
	
	    Templates: `500.html`
	    Context: None
	    """
	    from django.template import Context, loader
	    from django.http import HttpResponseServerError
	
	    t = loader.get_template('500.html') # You need to create a 500.html template.
	    return HttpResponseServerError(t.render(Context({
	        'request': request,
	    })))

Once we've successfully added the request context variable, adding the Sentry reference ID to our 500.html is simple::

	<p>You've encountered an error, oh noes!</p>
	{% if request.sentry.id %}
	    <p>If you need assistance, you may reference this error as <strong>{{ request.sentry.id }}</strong>.</p>
	{% endif %}

Other Settings
--------------

Several options exist to configure django-sentry via your ``settings.py``:

SENTRY_CLIENT
~~~~~~~~~~~~~~

In some situations you may wish for a slightly different behavior to how Sentry communicates with your server. For
this, Sentry allows you to specify a custom client::

	SENTRY_CLIENT = 'sentry.client.base.SentryClient'

In addition to the default client (which will handle multi-db and REMOTE_URL for you) we also include two additional options:

LoggingSentryClient
*******************

Pipes all Sentry errors to a named logger: ``sentry``. If you wish to use Sentry in a strictly client based logging mode
this would be the way to do it.

::

	SENTRY_CLIENT = 'sentry.client.log.LoggingSentryClient'

CelerySentryClient
******************

Integrates with the Celery message queue (http://celeryproject.org/). To use this you will also need to add ``sentry.client.celery`` to ``INSTALLED_APPS`` for ``tasks.py`` auto discovery.

You may also specify ``CELERY_ROUTING_KEY`` to change the task queue
name (defaults to ``sentry``).

::

	SENTRY_CLIENT = 'sentry.client.celery.CelerySentryClient'
	
	INSTALLED_APPS = (
	    ...,
	    'sentry.client.celery',
	)

AsyncSentryClient
*****************

Spawns a background thread within the process that will handle sending messages upstream.

::

	SENTRY_CLIENT = 'sentry.client.async.AsyncSentryClient'

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

SENTRY_TESTING
~~~~~~~~~~~~~~

Enabling this setting allows the testing of Sentry exception handler even if Django ``DEBUG`` is enabled.

Default value is ``False``

.. note:: Normally when Django DEBUG is enabled the Sentry exception handler is immediately skipped

SENTRY_NAME
~~~~~~~~~~~

This will override the ``server_name`` value for this installation. Defaults to ``socket.gethostname()``.

SENTRY_URL_PREFIX
~~~~~~~~~~~~~~~~~

Absolute URL to the sentry root directory. Should not include a trailing slash. Defaults to ``""``.

SENTRY_EXCLUDE_PATHS
~~~~~~~~~~~~~~~~~~~~

Extending this allow you to ignore module prefixes when we attempt to discover which function an error comes from (typically a view)

SENTRY_INCLUDE_PATHS
~~~~~~~~~~~~~~~~~~~~

By default Sentry only looks at modules in INSTALLED_APPS for drilling down where an exception is located

SENTRY_MAX_LENGTH_LIST
~~~~~~~~~~~~~~~~~~~~~~

The maximum number of items a list-like container should store. Defaults to ``50``.

SENTRY_MAX_LENGTH_STRING
~~~~~~~~~~~~~~~~~~~~~~~~

The maximum characters of a string that should be stored. Defaults to ``200``.

SENTRY_PUBLIC
~~~~~~~~~~~~~

Should Sentry be protected by a username and password (using @login_required) or be publicly accessible. Defaults to ``False`` (password protection).

SENTRY_AUTO_LOG_STACKS
~~~~~~~~~~~~~~~~~~~~~~

.. versionadded:: 1.10.0

Should Sentry automatically log frame stacks (including locals) for ``create_from_record`` (``logging``) calls as it would for exceptions. Defaults to ``False``.

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

Configuration
=============

Multi-server configuration
--------------------------

To configure Sentry for use in a multi-server environment, first you'll want to configure your Sentry server (not your application)::

	INSTALLED_APPS = [
	  ...
	  'indexer',
	  'paging',
	  'sentry',
	  'sentry.client',
	]
	
	SENTRY_KEY = '0123456789abcde'

And on each of your application servers, specify the URL of the Sentry server, add ``sentry.client`` to ``INSTALLED_APPS``, and specify the same key used in your Sentry server's settings::

	# This should be the absolute URI of sentries store view
	SENTRY_REMOTE_URL = 'http://your.sentry.server/sentry/store/'
	
	INSTALLED_APPS = [
	  ...
	  'sentry.client',
	]
	
	SENTRY_KEY = '0123456789abcde'

You may also specify an alternative timeout to the default (which is 5 seconds) for all outgoing logging requests (only works with python 2.6 and above)::

	SENTRY_REMOTE_TIMEOUT = 5

Sentry also allows you to support high availability by pushing to multiple servers::

	SENTRY_REMOTE_URL = ['http://server1/sentry/store/', 'http://server2/sentry/store/']

Integration with ``logging``
----------------------------

django-sentry supports the ability to directly tie into the ``logging`` module. To use it simply add ``SentryHandler`` to your logger::

	import logging
	from sentry.client.handlers import SentryHandler
	
	logging.getLogger().addHandler(SentryHandler())

	# Add StreamHandler to sentry's default so you can catch missed exceptions
	logger = logging.getLogger('sentry.errors')
	logger.propagate = False
	logger.addHandler(logging.StreamHandler())

You can also use the ``exc_info`` and ``extra=dict(url=foo)`` arguments on your ``log`` methods. This will store the appropriate information and allow django-sentry to render it based on that information::

	logging.error('There was some crazy error', exc_info=sys.exc_info(), extra={'url': request.build_absolute_uri()})

You may also pass additional information to be stored as meta information with the event. As long as the key
name is not reserved and not private (_foo) it will be displayed on the Sentry dashboard. To do this, pass it as ``data`` within
your ``extra`` clause::

	logging.error('There was some crazy error', exc_info=sys.exc_info(), extra={
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

Other Settings
--------------

Several options exist to configure django-sentry via your ``settings.py``:

#############
SENTRY_CLIENT
#############

In some situations you may wish for a slightly different behavior to how Sentry communicates with your server. For
this, Sentry allows you to specify a custom client::

	SENTRY_CLIENT = 'sentry.client.base.SentryClient'

In addition to the default client (which will handle multi-db and REMOTE_URL for you) we also include two additional options:

*******************
LoggingSentryClient
*******************

Pipes all Sentry errors to a named logger: ``sentry``. If you wish to use Sentry in a strictly client based logging mode
this would be the way to do it.

	SENTRY_CLIENT = 'sentry.client.log.LoggingSentryClient'

******************
CelerySentryClient
******************

Integrates with the Celery message queue (http://celeryproject.org/). To use this you will also need to add ``sentry.client.celery`` to ``INSTALLED_APPS`` for ``tasks.py`` auto discovery. You may also specify ``SENTRY_CELERY_ROUTING_KEY`` to change the task queue
name (defaults to ``sentry``).

	SENTRY_CLIENT = 'sentry.client.celery.CelerySentryClient'

#############
SENTRY_ADMINS
#############

On smaller sites you may wish to enable throttled emails, we recommend doing this by first
removing the ``ADMINS`` setting in Django, and adding in ``SENTRY_ADMINS``::

	ADMINS = ()
	SENTRY_ADMINS = ('root@localhost',)

This will send out a notification the first time an error is seen, and the first time an error is
seen after it has been resolved.


##############
SENTRY_TESTING
##############

Enabling this setting allows the testing of Sentry exception handler even if Django DEBUG is enabled.

Default value is ``False``

.. note:: Normally when Django DEBUG is enabled the Sentry exception handler is immediately skipped

###########
SENTRY_NAME
###########

This will override the ``server_name`` value for this installation. Defaults to ``socket.get_hostname()``.
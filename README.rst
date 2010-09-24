-------------
django-sentry
-------------

Sentry provides you with a generic interface to view and interact with your error logs. By
default, it will catch any exception thrown by Django and store it in a database. With this
it allows you to interact and view near real-time information to discover issues and more
easily trace them in your application.

==========
Screenshot
==========

.. image:: http://dl.dropbox.com/u/116385/sentry2.jpg
   
============
Requirements
============
 
 - **Django >= 1.2** (to use a secondary database to store error logs)
 - **django-indexer** (stores metadata indexes)
 - **django-paging**
 - **pygooglechart** (to generate *optional* error reports)

=========
Upgrading
=========

If you use South migrations, simply run::

	python manage.py migrate sentry

If you don't use South, then start.

=======
Install
=======

The easiest way to install the package is via pip::

	pip install django-sentry --upgrade

OR, if you're not quite on the same page (work on that), with setuptools::

	easy_install django-sentry

Once installed, update your settings.py and add ``sentry``, ``sentry.client``, ``indexer``, and ``paging`` to ``INSTALLED_APPS``::

	INSTALLED_APPS = (
	    'django.contrib.admin',
	    'django.contrib.auth',
	    'django.contrib.contenttypes',
	    'django.contrib.sessions',
	    
	    # don't forget to add the dependancies!
	    'indexer',
	    'paging',
	    'sentry',
	    'sentry.client',
	    ...
	)

Finally, run ``python manage.py syncdb`` to create the database tables.

(If you use South, you'll need to use ``python manage.py migrate sentry``)

==========================
Multi-server configuration
==========================

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

You may also specify an alternative timeout to the default (which is 5 seconds) for all outgoing logging requests::

	SENTRY_REMOTE_TIMEOUT = 5

Sentry also allows you to support high availability by pushing to multiple servers::

	SENTRY_REMOTE_URL = ['http://server1/sentry/store/', 'http://server2/sentry/store/']

===========================
Other configuration options
===========================

Several options exist to configure django-sentry via your ``settings.py``:

#############
SENTRY_CLIENT
#############

In some situations you may wish for a slightly different behavior to how Sentry communicates with your server. For
this, Sentry allows you to specify a custom client::

	SENTRY_CLIENT = 'sentry.client.base.SentryClient'

In addition to the default client (which will handle multi-db and REMOTE_URL for you) we also include two additional options:

#####################################
sentry.client.log.LoggingSentryClient
#####################################

Pipes all Sentry errors to a named logger: ``sentry``. If you wish to use Sentry in a strictly client based logging mode
this would be the way to do it.

#######################################
sentry.client.celery.CelerySentryClient
#######################################

Integrates with the Celery message queue (http://celeryproject.org/). To use this you will also need to add ``sentry.client.celery`` to ``INSTALLED_APPS`` for ``tasks.py`` auto discovery. You may also specify ``SENTRY_CELERY_ROUTING_KEY`` to change the task queue
name (defaults to ``sentry``).

#############
SENTRY_ADMINS
#############

On smaller sites you may wish to enable throttled emails, we recommend doing this by first
removing the ``ADMINS`` setting in Django, and adding in ``SENTRY_ADMINS``::

	ADMINS = ()
	SENTRY_ADMINS = ('root@localhost',)

This will send out a notification the first time an error is seen, and the first time an error is
seen after it has been resolved.

#######################
SENTRY_CATCH_404_ERRORS
#######################

Enable catching of 404 errors in the logs. Default value is ``False``::

	SENTRY_CATCH_404_ERRORS = True

You can skip other custom exception types by adding a ``skip_sentry = True`` attribute to them.

#####################
SENTRY_DATABASE_USING
#####################

Use a secondary database to store error logs. This is useful if you have several websites and want to aggregate error logs onto one database server::

	# This should correspond to a key in your DATABASES setting
	SENTRY_DATABASE_USING = 'default'

You should also enable the ``SentryRouter`` to avoid things like extraneous table creation::

	DATABASE_ROUTERS = [
		'sentry.routers.SentryRouter',
		...
	]


.. note:: This functionality REQUIRES Django 1.2. We highly recommend using HTTP over multi-db, as it can cause issues with dependancies such as django-indexer.


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


############################
Integration with ``logging``
############################

django-sentry supports the ability to directly tie into the ``logging`` module. To use it simply add ``SentryHandler`` to your logger::

	import logging
	from sentry.client.handlers import SentryHandler
	
	logging.getLogger().addHandler(SentryHandler())

	# Add StreamHandler to sentry's default so you can catch missed exceptions
	logging.getLogger('sentry').addHandler(logging.StreamHandler())

You can also use the ``exc_info`` and ``extra=dict(url=foo)`` arguments on your ``log`` methods. This will store the appropriate information and allow django-sentry to render it based on that information::

	logging.error('There was some crazy error', exc_info=sys.exc_info(), extra={'url': request.build_absolute_uri()})

You may also pass additional information to be stored as meta information with the event. As long as the key
name is not reserved and not private (_foo) it will be displayed on the Sentry dashboard. To do this, pass it as ``data`` within
your ``extra`` clause::

	logging.error('There was some crazy error', exc_info=sys.exc_info(), extra={
	    'url': request.build_absolute_uri(),
	    'data': {'username': request.user.username}})

=====
Usage
=====

Set up a viewer server (or use your existing application server) and add sentry to your INSTALLED_APPS and your included URLs::

	# urls.py
	urlpatterns = patterns('',
	    (r'^admin/', include(admin.site.urls)),
	    (r'^sentry/', include('sentry.urls')),
	)

Now enjoy your beautiful new error tracking at ``/sentry/``.

===
API
===

For the technical, here's some further docs:

If you wish to access these within your own views and models, you may do so via the standard model API::

	from sentry.models import Message, GroupedMessage
	
	# Pull the last 10 unresolved errors.
	GroupedMessage.objects.filter(status=0).order_by('-last_seen')[0:10]

You can also record errors outside of handler if you want::

	from sentry.client.base import SentryClient
	
	try:
		...
	except Exception, exc:
		SentryClient.create_from_exception([exc_info=None, url=None, view=None])

If you wish to log normal messages (useful for non-``logging`` integration)::

	from sentry.client.base import SentryClient
	import logging
	
	SentryClient.create_from_text('Message Message'[, level=logging.WARNING, url=None])

Both the ``url`` and ``level`` parameters are optional. ``level`` should be one of the following:

* ``logging.DEBUG``
* ``logging.INFO``
* ``logging.WARNING``
* ``logging.ERROR``
* ``logging.FATAL``

If you have a custom exception class, similar to Http404, or something else you don't want to log,
you can also add ``skip_sentry = True`` to your exception class or instance, and sentry will simply ignore
the error.

=====
Notes
=====

* sentry-client will automatically integrate with django-idmapper.
* sentry-client supports South migrations.
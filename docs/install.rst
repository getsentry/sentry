Install
=======

If you haven't already, start by downloading Sentry. The easiest way is with *pip*::

	pip install django-sentry --upgrade

Or with *setuptools*::

	easy_install -U django-sentry

Once installed, update your settings.py and add ``sentry``, ``sentry.client``, ``indexer``, and ``paging`` to ``INSTALLED_APPS``::

	INSTALLED_APPS = (
	    'django.contrib.admin',
	    'django.contrib.auth',
	    'django.contrib.contenttypes',
	    'django.contrib.sessions',
	    
	    # don't forget to add the dependencies!
	    'indexer',
	    'paging',
	    'sentry',
	    'sentry.client',
	    ...
	)

You will also need to add ``sentry.urls`` to your url patterns::

	urlpatterns = patterns('',
	    (r'^sentry/', include('sentry.urls')),
	)

We also highly recommend setting ``TEMPLATE_DEBUG=True`` in your environment (not to be confused with ``DEBUG``). This will allow
Sentry to receive template debug information when it hits a syntax error.

Finally, run ``python manage.py syncdb`` to create the database tables.

.. note::

   We recommend using South for migrations. Initial migrations have already been created for Sentry in sentry/migrations/ so you only need to run ``python manage.py migrate sentry`` instead of ``syncdb``

.. seealso::

   See :doc:`extensions` for information on additional plugins and functionality included.

Requirements
------------

If you're installing it by hand, you'll need to fulfill the following requirements:
 
 - **Django >= 1.2**
 - **django-indexer** (stores metadata indexes)
 - **django-paging**

Upgrading
---------

Upgrading Sentry is fairly painless with South migrations::

	python manage.py migrate sentry

If you don't use South, then start.

Caveats
-------

#########################
Error Handling Middleware
#########################

If you already have middleware in place that handles ``process_exception`` you will need to take extra care when using Sentry.

For example, the following middleware would suppress Sentry logging due to it returning a response::

	class MyMiddleware(object):
	    def process_exception(self, request, exception):
	        return HttpResponse('foo')

To work around this, you can either disable your error handling middleware, or add something like the following::

	from django.core.signals import got_request_exception
	class MyMiddleware(object):
	    def process_exception(self, request, exception):
	        # Make sure the exception signal is fired for Sentry
	        got_request_exception.send(sender=self, request=request)
	        return HttpResponse('foo')

Or, alternatively, you can just enable Sentry responses::

	from sentry.client.models import sentry_exception_handler
	class MyMiddleware(object):
	    def process_exception(self, request, exception):
	        # Make sure the exception signal is fired for Sentry
	        sentry_exception_handler(request=request)
	        return HttpResponse('foo')

Deprecation Notes
-----------------

Milestones releases are 1.3 or 1.4, and our deprecation policy is to a two version step. For example,
a feature will be deprecated in 1.3, and completely removed in 1.4.

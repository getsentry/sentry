-------------
django-db-log
-------------

Logs Django exceptions to your database handler.

=========
Upgrading
=========

If you use South migrations, simply run::

	python manage.py migrate djangodblog

Otherwise, the first thing you will want to do is confirm your database matches. Do this by verifying your version, or simply taking a look at the changes::

	python manage.py sql djangodblog > dblog.sql
	mysqldump -d --skip-opt -uroot -p yourdatabase djangodblog_error djangodblog_errorbatch > dblog.cur.sql
	diff -u dblog.sql dblog.cur.sql

Note: the above example is using MySQL, and isn't going to give anywhere near a precise diff.

Review the diff, then make any changes which appear necessary.

###############
Notable Changes
###############

* 1.4.0 Added `logger` column to both Error and ErrorBatch. `traceback` and `class_name` are now nullable.
* 1.3.0 Added `level` column to both Error and ErrorBatch.

=======
Install
=======

The easiest way to install the package is via setuptools::

	pip install django-db-log --upgrade

OR, if you're not quite on the same page (work on that), with setuptools::

	easy_install django-db-log

Once installed, update your settings.py and add the middleware and installed apps settings::

	MIDDLEWARE_CLASSES = (
	    'django.middleware.common.CommonMiddleware',
	    'django.contrib.sessions.middleware.SessionMiddleware',
	    'django.contrib.auth.middleware.AuthenticationMiddleware',
	    ...
	    'djangodblog.middleware.DBLogMiddleware',
	)

	INSTALLED_APPS = (
	    'django.contrib.admin',
	    'django.contrib.auth',
	    'django.contrib.contenttypes',
	    'django.contrib.sessions',
	    'djangodblog',
	    ...
	)

Finally, run ``python manage.py syncdb`` to create the database tables.

=============
Configuration
=============

Several options exist to configure django-db-log via your ``settings.py``:

######################
DBLOG_CATCH_404_ERRORS
######################

Enable catching of 404 errors in the logs. Default value is ``False``::

	DBLOG_CATCH_404_ERRORS = True

You can skip other custom exception types by adding a ``skip_dblog = True`` attribute to them.

##############
DBLOG_DATABASE
##############

Use a secondary database to store error logs. This is useful if you have several websites and want to aggregate error logs onto one database server::

	# This should correspond to a key in your DATABASES setting
	DBLOG_DATABASE_USING = 'default'

Some things to note:

* This functionality REQUIRES Django 1.2.

############################
Integration with ``logging``
############################

django-db-log supports the ability to directly tie into your ``logging`` module entries. To use it simply define add ``DBLogHandler`` to your logger:

	import logging
	from djangodblog.handlers import DBLogHandler
	
	logging.getLogger().addHandler(DBLogHandler())

You can also use the ``exc_info`` and ``extra=dict(url=foo)`` arguments on your ``log`` methods. This will store the appropriate information and allow django-db-log to render it based on that information:

	logging.error('There was some crazy error', exc_info=sys.exc_info(), extra={'url': request.build_absolute_uri()})

=====
Usage
=====

You will find two new admin panels in the automatically built Django administration:

* Messages (Error)
* Message summaries (ErrorBatch)

It will store every single error inside of the `Errors` model, and it will store a collective, or summary, of errors inside of `Error batches` (this is more useful for most cases). If you are using this on multiple sites with the same database, the `Errors` table also contains the SITE_ID for which it the error appeared on.

If you wish to access these within your own views and models, you may do so via the standard model API::

	from djangodblog.models import Error, ErrorBatch
	
	# Pull the last 10 unresolved errors.
	ErrorBatch.objects.filter(status=0).order_by('-last_seen')[0:10]

You can also record errors outside of middleware if you want::

	from djangodblog.models import Error
	
	try:
		...
	except Exception, exc:
		Error.objects.create_from_exception(exc, [url=None])

If you wish to log normal messages (useful for non-``logging`` integration)::

	from djangodblog.models import Error
	import logging
	
	Error.objects.create_from_text('Error Message'[, level=logging.WARNING, url=None])

Both the ``url`` and ``level`` parameters are optional. ``level`` should be one of the following:

* ``logging.DEBUG``
* ``logging.INFO``
* ``logging.WARNING``
* ``logging.ERROR``
* ``logging.FATAL``

If you have a custom exception class, similar to Http404, or something else you don't want to log,
you can also add ``skip_dblog = True`` to your exception class or instance, and dblog will simply ignore
the error.

=====
Notes
=====

* django-db-log will automatically integrate with django-idmapper.
* django-db-log supports South migrations.
* The fact that the admin shows large quantities of results, even if there aren't, is not a bug. This is an efficiency hack on top of Django.
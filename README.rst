django-db-log
-------------

Logs Django exceptions to your database handler.

Install
=======

The easiest way to install the package is via setuptools::

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

Usage
=====

You will find two new admin panels in the automatically built Django administration:

* Errors
* Error batchs

It will store every single error inside of the `Errors` model, and it will store a collective, or summary, of errors inside of `Error batchs` (this is more useful for most cases).

Notes
=====

* django-db-log will automatically integrate with django-idmapper
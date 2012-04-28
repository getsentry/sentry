This is a sample Django app that illustrates various ways of sending data to Sentry.

To run this app you will need raven client installed::

    pip install raven

Edit :file:`settings.py` and change `SENTRY_DSN` so that it matches your Sentry server.

Then do::

    python manage.py syncdb
    python manage.py runserver

And visit these URLS:

- http://localhost:8000/captureMessage/
- http://localhost:8000/captureException/
- http://localhost:8000/loggingError/
- http://localhost:8000/page_no_exist/

For more information, see the `Configuring Django section of the Raven
documentation <http://raven.readthedocs.org/en/latest/config/django.html>`_.

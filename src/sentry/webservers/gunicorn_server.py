"""
sentry.webservers.gunicorn_server
~~~~~~~~~~~~~~~~~~~~

"""

from django.core.management import call_command


def run_server(options):
    print "Starting Gunicorn server..."
    call_command('run_gunicorn', **options)
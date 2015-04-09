"""

Start the celery clock service from the Django management command.

"""
from __future__ import absolute_import, unicode_literals

from celery.bin import beat

from sentry.celery import app
from sentry.queue.command import CeleryCommand

beat = beat.beat(app=app)


# this is a reimplementation of the djcelery 'celerybeat' command
class Command(CeleryCommand):
    """Run the celery periodic task scheduler."""
    options = (CeleryCommand.options
               + beat.get_options()
               + beat.preload_options)
    help = 'Old alias to the "celery beat" command.'

    def handle(self, *args, **options):
        beat.run(*args, **options)

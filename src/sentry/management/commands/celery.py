from __future__ import absolute_import, unicode_literals

from celery.bin import celery

from sentry.celery import app
from sentry.queue.command import CeleryCommand

base = celery.CeleryCommand(app=app)


# this is a reimplementation of the djcelery 'celery' command
class Command(CeleryCommand):
    """The celery command."""
    help = 'DEPRECATED see `sentry run {worker,cron} instead.'
    options = (CeleryCommand.options
               + base.get_options()
               + base.preload_options)

    def run_from_argv(self, argv):
        from sentry.runner.initializer import show_big_error
        if 'worker' in argv:
            show_big_error([
                '`sentry celery worker` is deprecated.',
                'Use `sentry run worker` instead.',
            ])
        elif 'beat' in argv:
            show_big_error([
                '`sentry celery beat` is deprecated.',
                'Use `sentry run cron` instead.',
            ])
        argv = self.handle_default_options(argv)
        if self.requires_model_validation:
            self.validate()
        base.execute_from_commandline(
            ['{0[0]} {0[1]}'.format(argv)] + argv[2:],
        )

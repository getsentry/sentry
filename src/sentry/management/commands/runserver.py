from __future__ import absolute_import

import os.path

from django.conf import settings
from django.core.management.commands.runserver import Command as RunserverCommand
from optparse import make_option
from subprocess import Popen


class Command(RunserverCommand):
    """
    ALmost identical to the built-in runserver except that we don't hijack
    static files.
    """
    help = "Starts a lightweight Web server for development"

    option_list = RunserverCommand.option_list + (
        make_option('--nowatcher', action='store_false', dest='use_watcher', default=True,
            help='Tells Sentry to NOT automatically recompile static distributions.'),
    )

    def run_watcher(self):
        cwd = os.path.join(settings.PROJECT_ROOT, os.pardir)

        gulp_bin = os.path.join('node_modules', '.bin', 'gulp')

        devnull = open('/dev/null', 'w')

        self.stdout.write('>> Running [gulp clean]')
        Popen([gulp_bin, 'clean'], cwd=cwd, stdout=devnull).wait()

        self.stdout.write('>> Running [gulp dist]')
        Popen([gulp_bin, 'dist'], cwd=cwd, stdout=devnull).wait()

        self.stdout.write('>> Running [gulp watch]')
        return Popen([gulp_bin, 'dist', 'watch'], cwd=cwd, stdout=devnull)

    def inner_run(self, *args, **options):
        if options['use_watcher']:
            watcher = self.run_watcher()

        try:
            self.stdout.write('>> Launching webserver..')
            super(Command, self).inner_run(*args, **options)
        finally:
            if watcher:
                watcher.terminate()

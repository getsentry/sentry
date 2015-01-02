from __future__ import absolute_import

import os
import os.path
import sys

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
        make_option('--nowatcher', action='store_false', dest='use_watcher', default=settings.DEBUG,
            help='Tells Sentry to NOT automatically recompile static distributions.'),
    )

    cwd = os.path.realpath(os.path.join(settings.PROJECT_ROOT, os.pardir, os.pardir))

    gulp_bin = os.path.join(cwd, 'node_modules', '.bin', 'gulp')

    def run_watcher(self):
        devnull = open('/dev/null', 'w')

        self.stdout.write('>> Running [gulp watch]')
        return Popen([self.gulp_bin, 'dist', 'watch'], cwd=self.cwd, stdout=devnull)

    def run_server(self):
        args = sys.argv
        self.stdout.write('>> Launching webserver..')
        return Popen(args + ['--nowatcher'], env=os.environ, cwd=self.cwd)

    def run(self, *args, **options):
        if options['use_watcher']:
            self.stdout.write('>> Running [gulp clean]')
            Popen([self.gulp_bin, 'clean'], cwd=self.cwd).wait()

            self.stdout.write('>> Running [gulp dist]')
            Popen([self.gulp_bin, 'dist'], cwd=self.cwd).wait()

            watcher = self.run_watcher()
            server = self.run_server()
            try:
                server.wait()
            finally:
                if watcher:
                    watcher.terminate()
        else:
            super(Command, self).run(*args, **options)

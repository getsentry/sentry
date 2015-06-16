from __future__ import absolute_import

import os
import os.path
import sys

from django.conf import settings
from django.core.management.color import color_style
from django.core.management.commands.runserver import Command as RunserverCommand
from optparse import make_option
from subprocess import Popen


class Command(RunserverCommand):
    """
    A version of Django's runserver which bundles Sentry's development
    tooling (such as static assets).
    """
    help = "Starts a lightweight Web server for development"

    option_list = RunserverCommand.option_list + (
        make_option(
            '--nowatcher', action='store_false', dest='use_watcher',
            default=settings.DEBUG,
            help='Tells Sentry to NOT automatically recompile static distributions.'),
    )

    cwd = os.path.realpath(os.path.join(settings.PROJECT_ROOT, os.pardir, os.pardir))

    gulp_bin = os.path.join(cwd, 'node_modules', '.bin', 'gulp')

    def get_env(self):
        from sentry.app import env
        result = os.environ.copy()
        result.update({
            'SENTRY_CONF': env.data['config'],
        })
        return result

    def run_watcher(self, verbosity, **options):
        if self.verbosity:
            self.stdout.write(self.style.HTTP_INFO('>> Running [gulp watch]'))
            stdout = None
        else:
            stdout = open('/dev/null', 'w')
        return Popen([self.gulp_bin, 'watch'], cwd=self.cwd, stdout=stdout,
                     env=self.get_env())

    def run_server(self, verbosity, **options):
        if self.verbosity:
            self.stdout.write(self.style.HTTP_INFO('>> Launching webserver..'))
        return Popen(sys.argv + ['--nowatcher'], cwd=self.cwd,
                     env=self.get_env())

    def run(self, *args, **options):
        self.style = color_style()
        self.verbosity = int(options['verbosity'])

        if options['use_watcher']:
            if self.verbosity:
                self.stdout.write(self.style.HTTP_INFO('>> Running [gulp dist]'))
                stdout = None
            else:
                stdout = open('/dev/null', 'w')
            Popen([self.gulp_bin, 'dist'], cwd=self.cwd, stdout=stdout,
                  env=self.get_env()).wait()

            watcher = self.run_watcher(**options)
            server = self.run_server(**options)
            try:
                server.wait()
            finally:
                if server.poll() is None:
                    server.kill()
                if watcher.poll() is None:
                    watcher.kill()
        else:
            super(Command, self).run(*args, **options)

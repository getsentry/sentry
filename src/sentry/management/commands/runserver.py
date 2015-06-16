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
            '--no-watchers', action='store_false', dest='use_watcher',
            default=settings.DEBUG,
            help='Tells Sentry to NOT automatically recompile static distributions.'),
    )

    cwd = os.path.realpath(os.path.join(settings.PROJECT_ROOT, os.pardir, os.pardir))

    def get_env(self):
        from sentry.app import env
        result = os.environ.copy()
        result.update({
            'SENTRY_CONF': env.data['config'],
        })
        return result

    def get_watchers(self):
        return settings.SENTRY_WATCHERS

    def run_watchers(self, verbosity, **options):
        if self.verbosity:
            stdout = None
        else:
            stdout = open('/dev/null', 'w')

        env = self.get_env()
        result = []
        for watcher in self.get_watchers():
            if self.verbosity:
                self.stdout.write(self.style.HTTP_INFO('>> Running {0}'.format(watcher)))
            result.append(Popen(watcher, cwd=self.cwd, stdout=stdout, env=env))
        return result

    def run_server(self, verbosity, **options):
        if self.verbosity:
            self.stdout.write(self.style.HTTP_INFO('>> Launching webserver..'))
        return Popen(sys.argv + ['--no-watchers'], cwd=self.cwd,
                     env=self.get_env())

    def run(self, *args, **options):
        self.style = color_style()
        self.verbosity = int(options['verbosity'])

        if options['use_watcher']:
            watcher_list = self.run_watchers(**options)
            server = self.run_server(**options)
            try:
                server.wait()
            finally:
                if server.poll() is None:
                    server.kill()
                for watcher in watcher_list:
                    if watcher.poll() is None:
                        watcher.kill()
        else:
            super(Command, self).run(*args, **options)

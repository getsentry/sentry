"""
sentry.management.commands.start
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import sys

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from optparse import make_option


class Command(BaseCommand):
    args = '<service>'
    help = 'Starts the specified service'

    option_list = BaseCommand.option_list + (
        make_option('--debug',
            action='store_true',
            dest='debug',
            default=False),
        make_option('--noupgrade',
            action='store_false',
            dest='upgrade',
            default=True),
        make_option('--workers', '-w',
            dest='workers',
            type=int,
            default=None),
        make_option('--noinput',
            action='store_true',
            dest='noinput',
            default=False,
            help='Tells Django to NOT prompt the user for input of any kind.',
        ),
    )

    def handle(self, service_name='http', address=None, upgrade=True, **options):
        from sentry.services import http, smtp

        if address:
            if ':' in address:
                host, port = address.split(':', 1)
                port = int(port)
            else:
                host = address
                port = None
        else:
            host, port = None, None

        services = {
            'http': http.SentryHTTPServer,
            'smtp': smtp.SentrySMTPServer,
        }

        if service_name == 'worker':
            raise CommandError('The ``worker`` service has been replaced with ``celeryd``.')

        if upgrade:
            # Ensure we perform an upgrade before starting any service
            print("Performing upgrade before service startup...")
            call_command('upgrade', verbosity=0, noinput=options.get('noinput'))

        try:
            service_class = services[service_name]
        except KeyError:
            raise CommandError('%r is not a valid service' % service_name)

        service = service_class(
            debug=options.get('debug'),
            host=host,
            port=port,
            workers=options.get('workers'),
        )

        # remove command line arguments to avoid optparse failures with service code
        # that calls call_command which reparses the command line, and if --noupgrade is supplied
        # a parse error is thrown
        sys.argv = sys.argv[:1]

        print("Running service: %r" % service_name)
        service.run()

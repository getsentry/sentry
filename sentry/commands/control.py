"""
sentry.commands.control
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.commands.utils import options, opt, consume_args
from sentry.services import http, worker, daemon
import os
import os.path


SERVICES = {
    'http': http.SentryHTTPServer,
    'worker': worker.SentryWorker,
}


def get_daemon_for_service(service, daemonize=True, **options):
    from sentry.conf import settings

    service_class = SERVICES[service]

    app = service_class(**options)

    kwargs = {
        'app': app,
        'detach_process': daemonize,
    }
    if daemonize:
        log = open(os.path.join(settings.LOG_DIR, '%s.log' % (service,)), 'w+')
        kwargs.update({
            'pidfile': os.path.join(settings.RUN_DIR, '%s.pid' % (service,)),
            'stderr': log,
            'stdout': log,
        })

    proc = daemon.Daemon(**kwargs)

    return proc


@options(
    opt('--daemon', '-d', action='store_true', default=True, dest='daemonize'),
    opt('--no-daemon', '-f', action='store_false', default=True, dest='daemonize'),
    opt('--debug', action='store_true', default=False, dest='debug'),
)
@consume_args
def start(args, daemonize=True, debug=False):
    from sentry.conf import settings

    services = args[1:]
    if not services:
        services = SERVICES.keys()

    if len(services) > 1 and not daemonize:
        raise ValueError('You can not start all services in the foreground.')

    for service in services:
        if service not in services:
            raise ValueError('Service not found: %r' % service)

        if not os.path.exists(settings.LOG_DIR):
            os.makedirs(settings.LOG_DIR)

        if not os.path.exists(settings.RUN_DIR):
            os.makedirs(settings.RUN_DIR)

        proc = get_daemon_for_service(service, daemonize, debug=debug)

        proc.start()


@consume_args
def stop(args):
    # TODO: we should improve upon this so it just discovers the PID
    # for an app and sends the signal
    services = args[1:]
    if not services:
        services = SERVICES.keys()

    for service in services:
        if service not in services:
            raise ValueError('Service not found: %r' % service)

        proc = get_daemon_for_service(service)

        proc.stop()


@consume_args
def restart(args):
    # TODO: we should improve upon this so it just discovers the PID
    # for an app and sends the signal
    services = args[1:]
    if not services:
        services = SERVICES.keys()

    for service in services:
        if service not in services:
            raise ValueError('Service not found: %r' % service)

        proc = get_daemon_for_service(service)

        proc.restart()

"""
sentry.commands.control
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.commands.utils import options, opt, consume_args
from sentry.services import http, worker, daemon, udp
import os
import os.path


services = {
    'http': http.SentryHTTPServer,
    'worker': worker.SentryWorker,
    'udp': udp.SentryUDPServer,
}


def get_service_from_args(args):
    if len(args) == 2:
        service = args[1]
    else:
        service = 'http'

    if service not in services:
        raise ValueError(service)

    return service


def get_daemon_for_service(service, daemonize=True, **options):
    from sentry.conf import settings

    service_class = services[service]

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
    opt('--daemon', '-d', action='store_true', default=False, dest='daemonize'),
    opt('--no-daemon', '-f', action='store_false', default=False, dest='daemonize'),
    opt('--debug', action='store_true', default=False, dest='debug'),
)
@consume_args
def start(args, daemonize=False, debug=False):
    from sentry.conf import settings
    from sentry.commands.upgrade import upgrade

    if not os.path.exists(settings.LOG_DIR):
        os.makedirs(settings.LOG_DIR)

    if not os.path.exists(settings.RUN_DIR):
        os.makedirs(settings.RUN_DIR)

    # Ensure we force an environment upgrade before we start the server
    upgrade()

    service = get_service_from_args(args)

    proc = get_daemon_for_service(service, daemonize, debug=debug)

    proc.start()


@consume_args
def stop(args):
    # TODO: we should improve upon this so it just discovers the PID
    # for an app and sends the signal
    service = get_service_from_args(args)

    proc = get_daemon_for_service(service)

    proc.stop()


@consume_args
def restart(args):
    # TODO: we should improve upon this so it just discovers the PID
    # for an app and sends the signal
    service = get_service_from_args(args)

    proc = get_daemon_for_service(service)

    proc.restart()

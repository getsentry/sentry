#!/usr/bin/env python
import eventlet
import errno
import imp
import logging
import os
import os.path
import sys

from daemon.daemon import DaemonContext
from daemon.runner import DaemonRunner, make_pidlockfile
from django.conf import settings as django_settings
from django.core.management import call_command
from eventlet import wsgi
from optparse import OptionParser
from sentry import VERSION

KEY_LENGTH = 40

SETTINGS_TEMPLATE = """
import os.path

from sentry.conf.server import *

ROOT = os.path.dirname(__file__)

DATABASES = {
    'default': {
        # You can swap out the engine for MySQL easily by changing this value
        # to ``django.db.backends.mysql`` or to PostgreSQL with
        # ``django.db.backends.postgresql_psycopg2``
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(ROOT, 'sentry.db'),
        'USER': 'postgres',
        'PASSWORD': '',
        'HOST': '',
        'PORT': '',
    }
}

SENTRY_KEY = %(default_key)r

# Set this to false to require authentication
SENTRY_PUBLIC = True

SENTRY_WEB_HOST = '0.0.0.0'
SENTRY_WEB_PORT = 9000

SENTRY_WEB_LOG_FILE = os.path.join(ROOT, 'sentry.log')
SENTRY_WEB_PID_FILE = os.path.join(ROOT, 'sentry.pid')
"""

def copy_default_settings(filepath):
    """
    Creates a default settings file at ``filepath``.
    """
    dirname = os.path.dirname(filepath)
    if not os.path.exists(dirname):
        os.makedirs(dirname)

    with open(filepath, 'w') as fp:
        key = os.urandom(KEY_LENGTH)

        output = SETTINGS_TEMPLATE % dict(default_key=key)
        fp.write(output)

def settings_from_file(filename, silent=False):
    """
    Configures django settings from an arbitrary (non sys.path) filename.
    """
    mod = imp.new_module('config')
    mod.__file__ = filename
    try:
        execfile(filename, mod.__dict__)
    except IOError, e:
        if silent and e.errno in (errno.ENOENT, errno.EISDIR):
            return False
        e.strerror = 'Unable to load configuration file (%s)' % e.strerror
        raise

    tuple_settings = ("INSTALLED_APPS", "TEMPLATE_DIRS")

    if not django_settings.configured:
        django_settings.configure()

    for setting in dir(mod):
        if setting == setting.upper():
            setting_value = getattr(mod, setting)
            if setting in tuple_settings and type(setting_value) == str:
                setting_value = (setting_value,) # In case the user forgot the comma.
            setattr(django_settings, setting, setting_value)

class SentryServer(DaemonRunner):
    pidfile_timeout = 10
    start_message = u"started with pid %(pid)d"

    def __init__(self, host=None, port=None, pidfile=None,
                 logfile=None, daemonize=False, debug=False):
        from sentry.conf import settings

        if not logfile:
            logfile = settings.WEB_LOG_FILE

        logfile = os.path.realpath(logfile)
        pidfile = os.path.realpath(pidfile or settings.WEB_PID_FILE)

        if daemonize:
            detach_process = True
        else:
            detach_process = False

        self.daemon_context = DaemonContext(detach_process=detach_process)
        self.daemon_context.stdout = open(logfile, 'w+')
        self.daemon_context.stderr = open(logfile, 'w+', buffering=0)

        self.debug = debug
        self.pidfile = make_pidlockfile(pidfile, self.pidfile_timeout)

        self.daemon_context.pidfile = self.pidfile

        self.host = host or settings.WEB_HOST
        self.port = port or settings.WEB_PORT

        # HACK: set app to self so self.app.run() works
        self.app = self

    def execute(self, action):
        self.action = action

        # Upgrade needs to happen before forking
        upgrade()

        if self.daemon_context.detach_process is False and self.action == 'start':
            # HACK:
            self.run()
        else:
            self.do_action()

    def run(self):
        from sentry.wsgi import application

        def inner_run():
            wsgi.server(eventlet.listen((self.host, self.port)), application)

        if self.debug:
            from django.utils import autoreload
            autoreload.main(inner_run)
        else:
            inner_run()


def cleanup(days=30, logger=None, site=None, server=None, level=None):
    """
    Deletes a portion of the trailing data in Sentry based on
    their creation dates. For example, if ``days`` is 30, this
    would attempt to clean up all data thats older than 30 days.

    :param logger: limit all deletion scopes to messages from the
                   specified logger.
    :param site: limit the message deletion scope to the specified
                 site.
    :param server: limit the message deletion scope to the specified
                   server.
    :param level: limit all deleteion scopes to messages that are greater
                  than or equal to level.
    """
    # TODO: we should collect which messages above were deleted
    # and potentially just send out post_delete signals where
    # GroupedMessage can update itself accordingly

    from sentry.models import GroupedMessage, Message, MessageCountByMinute, \
                              MessageFilterValue, FilterValue
    from sentry.utils.query import RangeQuerySetWrapper, SkinnyQuerySet
    import datetime

    ts = datetime.datetime.now() - datetime.timedelta(days=days)

    # Message
    qs = SkinnyQuerySet(Message).filter(datetime__lte=ts)
    if logger:
        qs = qs.filter(logger=logger)
    if site:
        qs = qs.filter(site=site)
    if server:
        qs = qs.filter(server_name=server)
    if level:
        qs = qs.filter(level__gte=level)

    groups_to_check = set()
    for obj in RangeQuerySetWrapper(qs):
        print ">>> Removing <%s: id=%s>" % (obj.__class__.__name__, obj.pk)
        obj.delete()
        groups_to_check.add(obj.group_id)

    if not (server or site):
        # MessageCountByMinute
        qs = SkinnyQuerySet(MessageCountByMinute).filter(date__lte=ts)
        if logger:
            qs = qs.filter(group__logger=logger)
        if level:
            qs = qs.filter(group__level__gte=level)

        for obj in RangeQuerySetWrapper(qs):
            print ">>> Removing <%s: id=%s>" % (obj.__class__.__name__, obj.pk)
            obj.delete()

        # GroupedMessage
        qs = SkinnyQuerySet(GroupedMessage).filter(last_seen__lte=ts)
        if logger:
            qs = qs.filter(logger=logger)
        if level:
            qs = qs.filter(level__gte=level)

        for obj in RangeQuerySetWrapper(qs):
            for key, value in SkinnyQuerySet(MessageFilterValue).filter(group=obj).values_list('key', 'value'):
                if not MessageFilterValue.objects.filter(key=key, value=value).exclude(group=obj).exists():
                    print ">>> Removing <FilterValue: key=%s, value=%s>" % (key, value)
                    FilterValue.objects.filter(key=key, value=value).delete()
            print ">>> Removing <%s: id=%s>" % (obj.__class__.__name__, obj.pk)
            obj.delete()

    # attempt to cleanup any groups that may now be empty
    groups_to_delete = []
    for group_id in groups_to_check:
        if not Message.objects.filter(group=group_id).exists():
            groups_to_delete.append(group_id)

    if groups_to_delete:
        for obj in SkinnyQuerySet(GroupedMessage).filter(pk__in=groups_to_delete):
            for key, value in SkinnyQuerySet(MessageFilterValue).filter(group=obj).values_list('key', 'value'):
                if not MessageFilterValue.objects.filter(key=key, value=value).exclude(group=obj).exists():
                    print ">>> Removing <FilterValue: key=%s, value=%s>" % (key, value)
                    FilterValue.objects.filter(key=key, value=value).delete()
            print ">>> Removing <%s: id=%s>" % (obj.__class__.__name__, obj.pk)
            obj.delete()

def upgrade(interactive=True):
    from sentry.conf import settings

    call_command('syncdb', database=settings.DATABASE_USING or 'default', interactive=interactive)

    if 'south' in django_settings.INSTALLED_APPS:
        call_command('migrate', database=settings.DATABASE_USING or 'default', interactive=interactive)

def main():
    command_list = ('start', 'stop', 'restart', 'cleanup', 'upgrade')
    args = sys.argv
    if len(args) < 2 or args[1] not in command_list:
        print "usage: sentry [command] [options]"
        print
        print "Available subcommands:"
        for cmd in command_list:
            print "  ", cmd
        sys.exit(1)

    parser = OptionParser(version="%%prog %s" % VERSION)
    parser.add_option('--config', metavar='CONFIG')
    if args[1] == 'start':
        parser.add_option('--host', metavar='HOSTNAME')
        parser.add_option('--port', type=int, metavar='PORT')
        parser.add_option('--daemon', action='store_true', default=False, dest='daemonize')
        parser.add_option('--no-daemon', action='store_false', default=False, dest='daemonize')
        parser.add_option('--debug', action='store_true', default=False, dest='debug')
        parser.add_option('--pidfile', dest='pidfile')
        parser.add_option('--logfile', dest='logfile')
    elif args[1] == 'stop':
        parser.add_option('--pidfile', dest='pidfile')
        parser.add_option('--logfile', dest='logfile')
    elif args[1] == 'cleanup':
        parser.add_option('--days', default='30', type=int,
                          help='Numbers of days to truncate on.')
        parser.add_option('--logger',
                          help='Limit truncation to only entries from logger.')
        parser.add_option('--site',
                          help='Limit truncation to only entries from site.')
        parser.add_option('--server',
                          help='Limit truncation to only entries from server.')
        parser.add_option('--level',
                          help='Limit truncation to only entries greater than or equal to level (e.g. DEBUG).')

    (options, args) = parser.parse_args()

    if options.config:
        # assumed to be a file
        config_path = options.config
    else:
        config_path = os.path.expanduser(os.path.join('~', '.sentry', 'sentry.conf.py'))

    if not os.path.exists(config_path):
        try:
            copy_default_settings(config_path)
        except OSError, e:
            raise e.__class__, 'Unable to write default settings file to %r' % config_path

    settings_from_file(config_path)

    if getattr(options, 'debug', False):
        django_settings.DEBUG = True

    if args[0] == 'upgrade':
        upgrade()

    elif args[0] == 'start':
        app = SentryServer(host=options.host, port=options.port,
                           pidfile=options.pidfile, logfile=options.logfile,
                           daemonize=options.daemonize, debug=options.debug)
        app.execute(args[0])

    elif args[0] == 'restart':
        app = SentryServer()
        app.execute(args[0])

    elif args[0] == 'stop':
        app = SentryServer(pidfile=options.pidfile, logfile=options.logfile)
        app.execute(args[0])

    elif args[0] == 'cleanup':
        level = options.level
        if level is not None and not level.isdigit():
            level = getattr(logging, level.upper())

        cleanup(days=options.days, logger=options.logger, site=options.site, server=options.server,
                level=level)

    sys.exit(0)

if __name__ == '__main__':
    main()
#!/usr/bin/env python
"""
sentry.scripts.runner
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import base64
import datetime
import errno
import imp
import os
import os.path
import sys

from django.conf import settings as django_settings
from optparse import OptionParser
from sentry import VERSION, environment, commands


ALL_COMMANDS = (
    # General use commands
    'init',
    'upgrade',
    'start',
    'stop',
    'restart',
    'cleanup',

    # These should probably be hidden by default
    'manage',
)

KEY_LENGTH = 40

DEFAULT_CONFIG_PATH = os.environ.get('SENTRY_CONFIG',
  os.path.expanduser(os.path.join('~', '.sentry', 'sentry.conf.py')))

CONFIG_TEMPLATE = """
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
SENTRY_LOG_DIR = os.path.join(ROOT, 'log')
SENTRY_RUN_DIR = os.path.join(ROOT, 'run')
"""


def copy_default_settings(filepath):
    """
    Creates a default settings file at ``filepath``.
    """
    dirname = os.path.dirname(filepath)
    if not os.path.exists(dirname):
        os.makedirs(dirname)

    with open(filepath, 'w') as fp:
        key = base64.b64encode(os.urandom(KEY_LENGTH))

        output = CONFIG_TEMPLATE % dict(default_key=key)
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
                setting_value = (setting_value,)  # In case the user forgot the comma.
            setattr(django_settings, setting, setting_value)


def main():
    args = sys.argv
    if len(args) < 2 or args[1] not in ALL_COMMANDS:
        print "usage: sentry [command] [options]"
        print
        print "Available subcommands:"
        for cmd in ALL_COMMANDS:
            print "  ", cmd
        sys.exit(1)

    parser = OptionParser(version="%%prog %s" % VERSION)
    if args[1] == 'init':
        (options, args) = parser.parse_args()

        config_path = ' '.join(args[1:]) or DEFAULT_CONFIG_PATH

        if os.path.exists(config_path):
            resp = None
            while resp not in ('Y', 'n'):
                resp = raw_input('File already exists at %r, overwrite? [nY] ' % config_path)
                if resp == 'n':
                    print "Aborted!"
                    return

        try:
            copy_default_settings(config_path)
        except OSError, e:
            raise e.__class__, 'Unable to write default settings file to %r' % config_path

        print "Configuration file created at %r" % config_path

        return

    parser.add_option('--config', metavar='CONFIG', default=DEFAULT_CONFIG_PATH)

    command = getattr(commands, args[1])

    for option in getattr(command, 'options', []):
        parser.add_option(option)

    (options, args) = parser.parse_args()

    config_path = options.config

    # We hardcode skipping this check via init
    if not os.path.exists(config_path):
        raise ValueError("Configuration file does not exist. Use 'init' to initialize the file.")

    environment['config'] = config_path
    environment['start_date'] = datetime.datetime.utcnow()

    settings_from_file(config_path)

    # set debug
    if getattr(options, 'debug', False):
        django_settings.DEBUG = True

    # filter out reserved options
    kwargs = dict((k, v) for k, v in options.__dict__.iteritems() if k != 'config')

    # execute command
    if getattr(command, 'consume_args', False):
        command(args, **kwargs)
    else:
        command(**kwargs)

    sys.exit(0)

if __name__ == '__main__':
    main()

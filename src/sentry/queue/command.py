from __future__ import absolute_import

import celery
import os
import sys

from django.core.management.base import BaseCommand

DB_SHARED_THREAD = """\
DatabaseWrapper objects created in a thread can only \
be used in that same thread.  The object with alias '%s' \
was created in thread id %s and this is thread id %s.\
"""


def patch_thread_ident():
    # monkey patch django.
    # This patch make sure that we use real threads to get the ident which
    # is going to happen if we are using gevent or eventlet.
    # -- patch taken from gunicorn
    if getattr(patch_thread_ident, 'called', False):
        return
    try:
        from django.db.backends import BaseDatabaseWrapper, DatabaseError

        if 'validate_thread_sharing' in BaseDatabaseWrapper.__dict__:
            import thread
            _get_ident = thread.get_ident

            __old__init__ = BaseDatabaseWrapper.__init__

            def _init(self, *args, **kwargs):
                __old__init__(self, *args, **kwargs)
                self._thread_ident = _get_ident()

            def _validate_thread_sharing(self):
                if (not self.allow_thread_sharing
                        and self._thread_ident != _get_ident()):
                    raise DatabaseError(
                        DB_SHARED_THREAD % (
                            self.alias, self._thread_ident, _get_ident()),
                    )

            BaseDatabaseWrapper.__init__ = _init
            BaseDatabaseWrapper.validate_thread_sharing = \
                _validate_thread_sharing

        patch_thread_ident.called = True
    except ImportError:
        pass
patch_thread_ident()


class CeleryCommand(BaseCommand):
    options = BaseCommand.option_list
    skip_opts = ['--app', '--loader', '--config']
    keep_base_opts = False

    def get_version(self):
        return 'celery %s' % (celery.__version__)

    def execute(self, *args, **options):
        broker = options.get('broker')
        if broker:
            self.set_broker(broker)
        super(CeleryCommand, self).execute(*args, **options)

    def set_broker(self, broker):
        os.environ['CELERY_BROKER_URL'] = broker

    def run_from_argv(self, argv):
        self.handle_default_options(argv[2:])
        return super(CeleryCommand, self).run_from_argv(argv)

    def handle_default_options(self, argv):
        acc = []
        broker = None
        for i, arg in enumerate(argv):
            if '--settings=' in arg:
                _, settings_module = arg.split('=')
                os.environ['DJANGO_SETTINGS_MODULE'] = settings_module
            elif '--pythonpath=' in arg:
                _, pythonpath = arg.split('=')
                sys.path.insert(0, pythonpath)
            elif '--broker=' in arg:
                _, broker = arg.split('=')
            elif arg == '-b':
                broker = argv[i + 1]
            else:
                acc.append(arg)
        if broker:
            self.set_broker(broker)
        return argv if self.keep_base_opts else acc

    def die(self, msg):
        sys.stderr.write(msg)
        sys.stderr.write('\n')
        sys.exit()

    @property
    def option_list(self):
        return [x for x in self.options
                if x._long_opts[0] not in self.skip_opts]

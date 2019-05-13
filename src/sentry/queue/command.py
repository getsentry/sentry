from __future__ import absolute_import

import celery
import os
import sys

from django.core.management.base import BaseCommand


class CeleryCommand(BaseCommand):
    options = BaseCommand.option_list
    skip_opts = ["--app", "--loader", "--config"]
    keep_base_opts = False

    def get_version(self):
        return "celery %s" % (celery.__version__)

    def execute(self, *args, **options):
        broker = options.get("broker")
        if broker:
            self.set_broker(broker)
        super(CeleryCommand, self).execute(*args, **options)

    def set_broker(self, broker):
        os.environ["CELERY_BROKER_URL"] = broker

    def run_from_argv(self, argv):
        self.handle_default_options(argv[2:])
        return super(CeleryCommand, self).run_from_argv(argv)

    def handle_default_options(self, argv):
        acc = []
        broker = None
        for i, arg in enumerate(argv):
            if "--settings=" in arg:
                _, settings_module = arg.split("=")
                os.environ["DJANGO_SETTINGS_MODULE"] = settings_module
            elif "--pythonpath=" in arg:
                _, pythonpath = arg.split("=")
                sys.path.insert(0, pythonpath)
            elif "--broker=" in arg:
                _, broker = arg.split("=")
            elif arg == "-b":
                broker = argv[i + 1]
            else:
                acc.append(arg)
        if broker:
            self.set_broker(broker)
        return argv if self.keep_base_opts else acc

    def die(self, msg):
        sys.stderr.write(msg)
        sys.stderr.write("\n")
        sys.exit()

    @property
    def option_list(self):
        return [x for x in self.options if x._long_opts[0] not in self.skip_opts]

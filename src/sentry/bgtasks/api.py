from __future__ import absolute_import

import six
import time
import random
import logging
import threading
from contextlib import contextmanager

from django.conf import settings


logger = logging.getLogger("sentry.bgtasks")
tasks = {}


def bgtask(roles=None, interval=60):
    def decorator(f):
        return BgTask(callback=f, roles=roles, interval=interval)

    return decorator


class BgTask(object):
    def __init__(self, callback, roles=None, interval=60):
        self.callback = callback
        self.roles = roles or []
        self.interval = interval
        self.running = False

    @property
    def name(self):
        return "%s:%s" % (self.callback.__module__, self.callback.__name__)

    def run(self):
        if self.running:
            return
        self.running = True

        next_run = time.time() + self.interval * random.random()
        while self.running:
            now = time.time()
            if now >= next_run:
                try:
                    self.callback()
                except Exception:
                    logging.error("bgtask.failed", exc_info=True, extra=dict(task_name=self.name))
                next_run = now + self.interval
            time.sleep(1.0)

    def reconfigure(self, cfg):
        if "roles" in cfg:
            self.roles = cfg["roles"]
        if "interval" in cfg:
            self.interval = cfg["interval"]

    def spawn_daemon(self):
        if self.running:
            return
        logger.info("bgtask.spawn", extra=dict(task_name=self.name))
        t = threading.Thread(target=self.run)
        t.setDaemon(True)
        t.start()

    def stop(self):
        logger.info("bgtask.stop", extra=dict(task_name=self.name))
        self.running = False


def get_task(task_name):
    module, task_cls = task_name.split(":", 1)
    mod = __import__(module, None, None, [task_cls])
    return getattr(mod, task_cls)


def spawn_bgtasks(role):
    for import_name, cfg in six.iteritems(settings.BGTASKS):
        task = get_task(import_name)
        # This is already running
        if task.name in tasks:
            continue
        task.reconfigure(cfg)
        if role not in task.roles:
            continue
        task.spawn_daemon()
        tasks[task.name] = task


def shutdown_bgtasks():
    for task_name, task in list(six.iteritems(tasks)):
        task.stop()
        tasks.pop(task_name, None)


@contextmanager
def managed_bgtasks(role):
    spawn_bgtasks(role)
    try:
        yield
    finally:
        shutdown_bgtasks()

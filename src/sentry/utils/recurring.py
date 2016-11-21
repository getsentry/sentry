from __future__ import absolute_import

import time
import logging
import threading

from six import iteritems
from random import random


tasks = {}
logger = logging.getLogger(__name__)


def register_recurring(interval=None, jitter=0.1, services=['worker', 'web']):
    """Registers a function to run in the background for the given services
    at a specific interval.  The defaults can be overridden by the
    `RECURRING_SERVICE_TASKS` config.
    """
    def decorator(f):
        f.__recurring_config_defaults__ = {
            'interval': interval,
            'jitter': jitter,
            'services': services,
        }
        return f
    return decorator


def load_config():
    from django.conf import settings
    for task in settings.RECURRING_SERVICE_TASKS:
        module_name, func_name = task.rsplit('.', 1)
        mod = __import__(module_name, None, None, [func_name])
        callback = getattr(mod, func_name)
        config = dict(callback.__recurring_config_defaults__)
        config.update(settings.RECURRING_SERVICE_TASKS[task])
        config['callback'] = callback

        for service in config['services']:
            task_id = '%s:%s(%s)' % (
                module_name,
                func_name,
                service,
            )
            if config['interval'] is None:
                raise RuntimeError('No interval set for %s' % task_id)
            tasks.setdefault(service, {})[task_id] = config


def run_recurring_for_service(service):
    logger.info('Starting recurring tasks for %s', service)
    load_config()
    to_run = tasks.setdefault(service, {})
    last_run = {}
    start = time.time()

    def target():
        while 1:
            for task_id, task in iteritems(to_run):
                now = time.time()

                # How many seconds ago did we run last?
                last_ts = last_run.get(task_id)
                if last_ts is not None:
                    sec_ago = now - last_ts
                else:
                    sec_ago = now - start

                d = max(task['interval'] - (task['interval'] * random() *
                                            task['jitter'] * 2.0 - 1.0), 0.5)
                if sec_ago > d:
                    logger.debug('Running recurring task %s', task_id)
                    try:
                        task['callback']()
                    except Exception:
                        logger.exception('Recurring task failed')
                    last_run[task_id] = time.time()

            time.sleep(1.0)

    t = threading.Thread(target=target)
    t.setDaemon(True)
    t.start()

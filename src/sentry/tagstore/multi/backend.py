"""
sentry.tagstore.multi.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging
import six
import random
from threading import Thread
from six.moves.queue import Queue, Full
from operator import itemgetter

from sentry import options
from sentry.tagstore.base import TagStorage
from sentry.utils import metrics
from sentry.utils.imports import import_string


logger = logging.getLogger('sentry.tagstore.multi')


class QueuedRunner(object):
    """\
    Secondary backend runner that puts method calls on a bounded queue and drops them
    when the queue is full.

    A separate (non-main) thread works the queue.
    """

    def __init__(self):
        self.q = Queue(maxsize=100)
        self.worker_running = False

    def start_worker(self):
        def worker():
            while True:
                (func, args, kwargs) = self.q.get()
                try:
                    func(*args, **kwargs)
                    metrics.incr(
                        'tagstore.multi.runner.execute',
                        instance='success',
                        skip_internal=True,
                    )
                except Exception as e:
                    logger.exception(e)
                    metrics.incr(
                        'tagstore.multi.runner.execute',
                        instance='fail',
                        skip_internal=True,
                    )
                finally:
                    self.q.task_done()

        t = Thread(target=worker)
        t.setDaemon(True)
        t.start()

        self.worker_running = True

    def run(self, f, *args, **kwargs):
        if random.random() <= options.get('tagstore.multi-sampling'):
            if not self.worker_running:
                self.start_worker()

            try:
                self.q.put((f, args, kwargs), block=False)
                metrics.incr(
                    'tagstore.multi.runner.schedule',
                    instance='put',
                    skip_internal=True,
                )
            except Full:
                metrics.incr(
                    'tagstore.multi.runner.schedule',
                    instance='full',
                    skip_internal=True,
                )
                return
        else:
            metrics.incr(
                'tagstore.multi.runner.schedule',
                instance='sampled',
                skip_internal=True,
            )


class ImmediateRunner(object):
    """\
    Secondary backend runner that runs functions immediately. Useful for tests.
    """

    def run(self, f, *args, **kwargs):
        return f(*args, **kwargs)


class MultiTagStorage(TagStorage):
    """
    A backend which will write to multiple backends, and read from the first (by default).
    Writes to non-primary backends will happen on a background thread. This is designed to
    allow you to dual-write for the purpose of migration.

    >>> MultiTagStorage(backends=[
    >>>     ('sentry.tagstore.legacy.LegacyTagStorage', {}),
    >>>     ('sentry.tagstore.v2.V2TagStorage', {}),
    >>> ])
    """

    def __init__(self, backends, read_selector=itemgetter(0),
                 runner='QueuedRunner', **kwargs):
        assert backends, "you should provide at least one backend"

        self.backends = []
        for backend, backend_options in backends:
            if isinstance(backend, six.string_types):
                backend = import_string(backend)
            self.backends.append(backend(**backend_options))

        self.read_selector = read_selector
        self.runner = {'QueuedRunner': QueuedRunner, 'ImmediateRunner': ImmediateRunner}[runner]()

        super(TagStorage, self).__init__(**kwargs)

    def _call_all_backends(self, func, *args, **kwargs):
        """\
        Call `func` on all backends, returning the first backend's return value, or raising any exception.
        """

        metrics.incr(
            'tagstore.multi.call',
            instance=func,
            skip_internal=True,
        )

        ret_val = None
        exc = None
        for i, backend in enumerate(self.backends):
            try:
                f = getattr(backend, func)

                if (i == 0):
                    ret_val = f(*args, **kwargs)
                else:
                    self.runner.run(f, *args, **kwargs)
            except Exception as e:
                if exc is None:
                    exc = e

        if exc is not None:
            raise exc

        return ret_val

    def _call_one_backend(self, func, *args, **kwargs):
        """\
        Call `func` on one backend, using `read_selector` to choose which.
        """
        backend = self.read_selector(self.backends)
        return getattr(backend, func)(*args, **kwargs)

    def setup(self):
        return self._call_all_backends('setup')

    def create_tag_key(self, *args, **kwargs):
        return self._call_all_backends('create_tag_key', *args, **kwargs)

    def get_or_create_tag_key(self, *args, **kwargs):
        return self._call_all_backends('get_or_create_tag_key', *args, **kwargs)

    def create_tag_value(self, *args, **kwargs):
        return self._call_all_backends('create_tag_value', *args, **kwargs)

    def get_or_create_tag_value(self, *args, **kwargs):
        return self._call_all_backends('get_or_create_tag_value', *args, **kwargs)

    def create_group_tag_key(self, *args, **kwargs):
        return self._call_all_backends('create_group_tag_key', *args, **kwargs)

    def get_or_create_group_tag_key(self, *args, **kwargs):
        return self._call_all_backends('get_or_create_group_tag_key', *args, **kwargs)

    def create_group_tag_value(self, *args, **kwargs):
        return self._call_all_backends('create_group_tag_value', *args, **kwargs)

    def get_or_create_group_tag_value(self, *args, **kwargs):
        return self._call_all_backends('get_or_create_group_tag_value', *args, **kwargs)

    def create_event_tags(self, *args, **kwargs):
        return self._call_all_backends('create_event_tags', *args, **kwargs)

    def get_tag_key(self, *args, **kwargs):
        return self._call_one_backend('get_tag_key', *args, **kwargs)

    def get_tag_keys(self, *args, **kwargs):
        return self._call_one_backend('get_tag_keys', *args, **kwargs)

    def get_tag_value(self, *args, **kwargs):
        return self._call_one_backend('get_tag_value', *args, **kwargs)

    def get_tag_values(self, *args, **kwargs):
        return self._call_one_backend('get_tag_values', *args, **kwargs)

    def get_group_tag_key(self, *args, **kwargs):
        return self._call_one_backend('get_group_tag_key', *args, **kwargs)

    def get_group_tag_keys(self, *args, **kwargs):
        return self._call_one_backend('get_group_tag_keys', *args, **kwargs)

    def get_group_tag_value(self, *args, **kwargs):
        return self._call_one_backend('get_group_tag_value', *args, **kwargs)

    def get_group_tag_values(self, *args, **kwargs):
        return self._call_one_backend('get_group_tag_values', *args, **kwargs)

    def get_group_list_tag_value(self, *args, **kwargs):
        return self._call_one_backend('get_group_list_tag_value', *args, **kwargs)

    def delete_tag_key(self, *args, **kwargs):
        return self._call_all_backends('delete_tag_key', *args, **kwargs)

    def delete_all_group_tag_keys(self, *args, **kwargs):
        return self._call_all_backends('delete_all_group_tag_keys', *args, **kwargs)

    def delete_all_group_tag_values(self, *args, **kwargs):
        return self._call_all_backends('delete_all_group_tag_values', *args, **kwargs)

    def incr_tag_key_values_seen(self, *args, **kwargs):
        return self._call_all_backends('incr_tag_key_values_seen', *args, **kwargs)

    def incr_tag_value_times_seen(self, *args, **kwargs):
        return self._call_all_backends('incr_tag_value_times_seen', *args, **kwargs)

    def incr_group_tag_key_values_seen(self, *args, **kwargs):
        return self._call_all_backends('incr_group_tag_key_values_seen', *args, **kwargs)

    def incr_group_tag_value_times_seen(self, *args, **kwargs):
        return self._call_all_backends('incr_group_tag_value_times_seen', *args, **kwargs)

    def get_group_event_ids(self, *args, **kwargs):
        return self._call_one_backend('get_group_event_ids', *args, **kwargs)

    def get_groups_user_counts(self, *args, **kwargs):
        return self._call_one_backend('get_groups_user_counts', *args, **kwargs)

    def get_group_tag_value_count(self, *args, **kwargs):
        return self._call_one_backend('get_group_tag_value_count', *args, **kwargs)

    def get_top_group_tag_values(self, *args, **kwargs):
        return self._call_one_backend('get_top_group_tag_values', *args, **kwargs)

    def get_first_release(self, *args, **kwargs):
        return self._call_one_backend('get_first_release', *args, **kwargs)

    def get_last_release(self, *args, **kwargs):
        return self._call_one_backend('get_last_release', *args, **kwargs)

    def get_release_tags(self, *args, **kwargs):
        return self._call_one_backend('get_release_tags', *args, **kwargs)

    def get_group_ids_for_users(self, *args, **kwargs):
        return self._call_one_backend('get_group_ids_for_users', *args, **kwargs)

    def get_group_tag_values_for_users(self, *args, **kwargs):
        return self._call_one_backend('get_group_tag_values_for_users', *args, **kwargs)

    def get_group_ids_for_search_filter(self, *args, **kwargs):
        return self._call_one_backend('get_group_ids_for_search_filter', *args, **kwargs)

    def update_group_tag_key_values_seen(self, *args, **kwargs):
        return self._call_all_backends('update_group_tag_key_values_seen', *args, **kwargs)

    def get_tag_value_qs(self, *args, **kwargs):
        return self._call_one_backend('get_tag_value_qs', *args, **kwargs)

    def get_group_tag_value_qs(self, *args, **kwargs):
        return self._call_one_backend('get_group_tag_value_qs', *args, **kwargs)

    def get_event_tag_qs(self, *args, **kwargs):
        return self._call_one_backend('get_event_tag_qs', *args, **kwargs)

    def update_group_for_events(self, *args, **kwargs):
        return self._call_all_backends('update_group_for_events', *args, **kwargs)

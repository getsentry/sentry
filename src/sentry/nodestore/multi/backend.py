"""
sentry.nodestore.multi.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import random

import six

from sentry.nodestore.base import NodeStorage
from sentry.utils.imports import import_string


class MultiNodeStorage(NodeStorage):
    """
    A backend which will write to multiple backends, and read from a random
    choice.

    This is not intended for consistency, but is instead designed to allow you
    to dual-write for purposes of migrations.

    >>> MultiNodeStorage(backends=[
    >>>     ('sentry.nodestore.django.backend.DjangoNodeStorage', {}),
    >>>     ('sentry.nodestore.riak.backend.RiakNodeStorage', {}),
    >>> ], read_selector=lambda backends: backends[0])
    """
    def __init__(self, backends, read_selector=random.choice, **kwargs):
        assert backends, "you should provide at least one backend"

        self.backends = []
        for backend, backend_options in backends:
            if isinstance(backend, six.string_types):
                backend = import_string(backend)
            self.backends.append(backend(**backend_options))
        self.read_selector = read_selector
        super(MultiNodeStorage, self).__init__(**kwargs)

    def get(self, id):
        # just fetch it from a random backend, we're not aiming for consistency
        backend = self.read_selector(self.backends)
        return backend.get(id)

    def get_multi(self, id_list):
        backend = self.read_selector(self.backends)
        return backend.get_multi(id_list=id_list)

    def set(self, id, data):
        should_raise = False
        for backend in self.backends:
            try:
                backend.set(id, data)
            except Exception:
                should_raise = True

        if should_raise:
            raise

    def set_multi(self, values):
        should_raise = False
        for backend in self.backends:
            try:
                backend.set_multi(values)
            except Exception:
                should_raise = True

        if should_raise:
            raise

    def delete(self, id):
        should_raise = False
        for backend in self.backends:
            try:
                backend.delete(id)
            except Exception:
                should_raise = True

        if should_raise:
            raise

    def cleanup(self, cutoff_timestamp):
        should_raise = False
        for backend in self.backends:
            try:
                backend.cleanup(cutoff_timestamp)
            except Exception:
                should_raise = True

        if should_raise:
            raise

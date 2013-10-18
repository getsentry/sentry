"""
sentry.nodestore.multi.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import random

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
    >>> ])
    """
    def __init__(self, backends, **kwargs):
        assert backends, "you should provide at least one backend"

        self.backends = []
        for backend, backend_options in backends:
            cls = import_string(backend)
            self.backends.append(cls(**backend_options))
        super(MultiNodeStorage, self).__init__(**kwargs)

    def get(self, id):
        # just fetch it from a random backend, we're not aiming for consistency
        backend = random.choice(self.backends)
        return backend.get(id=id)

    def get_multi(self, id_list):
        backend = random.choice(self.backends)
        return backend.get_multi(id_list=id_list)

    def set(self, id, data):
        should_raise = False
        for backend in self.backends:
            try:
                backend.set(id=id, data=data)
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

"""
sentry.nodestore.base
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import uuid


class NodeStorage(object):
    def create(self, data, timestamp=None):
        node_id = uuid.uuid4().hex
        self.set(node_id, data, timestamp)
        return node_id

    def get(self, id):
        raise NotImplementedError

    def get_multi(self, id_list):
        return dict(
            (id, self.get(id))
            for id in id_list
        )

    def set(self, id, data, timestamp=None):
        raise NotImplementedError

    def set_multi(self, values):
        for v in values:
            self.set(**v)

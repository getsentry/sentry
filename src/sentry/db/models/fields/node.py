"""
sentry.db.models.fields.node
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import collections
import logging

from django.db import models

from sentry.utils.cache import memoize
from sentry.utils.compat import pickle
from sentry.utils.strings import decompress, compress

from .gzippeddict import GzippedDictField

__all__ = ('NodeField',)

logger = logging.getLogger('sentry.errors')


class NodeData(collections.MutableMapping):
    def __init__(self, id, data=None):
        self.id = id
        self._node_data = data

    def __getitem__(self, key):
        return self.data[key]

    def __setitem__(self, key, value):
        self.data[key] = value

    def __delitem__(self, key):
        del self.data[key]

    def __iter__(self):
        return iter(self.data)

    def __len__(self):
        return len(self.data)

    def __repr__(self):
        cls_name = type(self).__name__
        if self._node_data:
            return '<%s: id=%s data=%r>' % (
                cls_name, self.id, repr(self._node_data))
        return '<%s: id=%s>' % (self.id,)

    @memoize
    def data(self):
        if self._node_data is None:
            raise Exception('Must populate node data first')
        return self._node_data

    def bind_node_data(self, data):
        self.data = data


class NodeField(GzippedDictField):
    """
    Similar to the gzippedictfield except that it stores a reference
    to an external node.
    """
    __metaclass__ = models.SubfieldBase

    def to_python(self, value):
        if isinstance(value, basestring) and value:
            try:
                value = pickle.loads(decompress(value))
            except Exception, e:
                logger.exception(e)
                value = {}
        elif not value:
            value = {}

        if 'node_id' in value:
            node_id = value.pop('node_id')
            data = None
        else:
            node_id = None
            data = value

        return NodeData(node_id, data)

    def get_prep_value(self, value):
        if not value and self.null:
            # save ourselves some storage
            return None
        if value.id:
            result = {
                'node_id': value.id
            }
        else:
            result = value.data
        return compress(pickle.dumps(result))

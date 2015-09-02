"""
sentry.db.models.fields.node
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import collections
import logging
import six
import warnings

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from south.modelsinspector import add_introspection_rules

from sentry.utils.cache import memoize
from sentry.utils.compat import pickle
from sentry.utils.strings import decompress, compress

from .gzippeddict import GzippedDictField

__all__ = ('NodeField',)

logger = logging.getLogger('sentry')


class NodeUnpopulated(Exception):
    pass


class NodeIntegrityFailure(Exception):
    pass


class NodeData(collections.MutableMapping):
    def __init__(self, id, data=None):
        self.id = id
        self.ref = None
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
        return '<%s: id=%s>' % (cls_name, self.id,)

    @memoize
    def data(self):
        from sentry.app import nodestore

        if self._node_data is not None:
            return self._node_data

        elif self.id:
            if settings.DEBUG:
                raise NodeUnpopulated('You should populate node data before accessing it.')
            else:
                warnings.warn('You should populate node data before accessing it.')
            self.bind_data(nodestore.get(self.id) or {})
            return self._node_data

        return {}

    def bind_data(self, data, ref=None):
        self.ref = data.pop('_ref', ref)
        if ref is not None and self.ref != ref:
            raise NodeIntegrityFailure('Node reference for %s is invalid: %s != %s' % (
                self.id, ref, self.ref,
            ))
        self._node_data = data

    def bind_ref(self, instance):
        self.data['_ref'] = instance.pk


class NodeField(GzippedDictField):
    """
    Similar to the gzippedictfield except that it stores a reference
    to an external node.
    """
    __metaclass__ = models.SubfieldBase

    def contribute_to_class(self, cls, name):
        super(NodeField, self).contribute_to_class(cls, name)
        post_delete.connect(
            self.on_delete,
            sender=self.model,
            weak=False)

    def on_delete(self, instance, **kwargs):
        from sentry.app import nodestore

        value = getattr(instance, self.name)
        if not value.id:
            return

        nodestore.delete(value.id)

    def to_python(self, value):
        if isinstance(value, six.string_types) and value:
            try:
                value = pickle.loads(decompress(value))
            except Exception as e:
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
        from sentry.app import nodestore

        if not value and self.null:
            # save ourselves some storage
            return None

        # TODO(dcramer): we should probably do this more intelligently
        # and manually
        if not value.id:
            value.id = nodestore.create(value.data)
        else:
            nodestore.set(value.id, value.data)

        return compress(pickle.dumps({
            'node_id': value.id
        }))


add_introspection_rules([], ["^sentry\.db\.models\.fields\.node\.NodeField"])

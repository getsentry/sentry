from __future__ import absolute_import

import collections
import six


class Meta(object):
    def __init__(self, meta=None, path=None):
        self._meta = meta or {}
        self._path = path or []

    def enter(self, *path):
        return Meta(self._meta, path=self._path + map(six.text_type, path))

    def raw(self):
        meta = self._meta
        for key in self._path:
            meta = meta.get(key) or {}
        return meta

    def get(self):
        return self.raw().get('') or {}

    def create(self):
        meta = self._meta
        for key in self._path + ['']:
            if key not in meta or meta[key] is None:
                meta[key] = {}
            meta = meta[key]

        return meta

    def merge(self, other):
        other = other.get()
        if not other:
            return

        meta = self.create()
        err = meta.get('err')
        meta.update(other)

        if err and other.get('err'):
            meta['err'] = err + other['err']

    def get_errors(self):
        self.get().get('err') or []

    def add_error(self, error, value=None):
        meta = self.create()
        if 'err' not in meta or meta['err'] is None:
            meta['err'] = []
        meta['err'].append(six.text_type(error))

        if value is not None:
            meta['val'] = value


def get_valid(data, *path, **kwargs):
    """
    Safely resolves valid data from a dictionary with attached meta data. A
    value is only returned if the full path exists and none of the parent
    objects had errors attached.

    This function extracts meta data from the "_meta" key in the top level
    dictionary. For the use in nested data structures with out-of-place meta
    data, pass a ``meta=Meta(...)`` argument manually.

    If the path does not exist or contains errors, ``None`` is returned.
    """
    meta = kwargs.pop('meta', None) or Meta(data.get('_meta'))

    for key in path:
        meta = meta.enter(key)
        if meta.get_errors():
            return None
        if not isinstance(data, collections.Mapping) or key not in data:
            return None
        data = data[key]

    return data


def get_all_valid(data, *path, **kwargs):
    """
    Safely resolves a list of valid data from a dictionary with attached meta
    data. This is similar to `get_valid`, except that it assumes the resolved
    value is a list which it filters for valid elements.

    This function extracts meta data from the "_meta" key in the top level
    dictionary. For the use in nested data structures with out-of-place meta
    data, pass a ``meta=Meta(...)`` argument manually.

    If the path does not exist or contains errors, ``None`` is returned. If the
    resolved value is not a list, the original value is returned.
    """
    meta = kwargs.pop('meta', None) or Meta(data.get('_meta'))
    items = get_valid(data, *path, meta=meta, **kwargs)
    if not items or not isinstance(items, collections.Sequence):
        return items

    results = []
    meta = meta.enter(*path)
    for index, item in enumerate(items):
        if not meta.enter(index).get_errors():
            results.append(item)

    return results

from __future__ import absolute_import

import collections
import six


class Meta(object):
    """
    A lazy view to detached validation and normalization meta data. It allows to
    safely traverse the meta tree and create a deep path lazily. Use ``enter``
    to get a view to the meta data inside a specific key.

    The ``Meta`` object is a shallow view onto the top-level meta structure and
    only traverses data when actually accessing attributes. Thus, constructing
    Meta or calling ``enter`` is relatively cheap.

    To modify data for a certain path, use ``create`` and modify the returned
    dict. Alternatively, use the ``merge`` or ``add_error`` convenience methods.
    """

    def __init__(self, meta=None, path=None):
        self._meta = meta or {}
        self._path = path or []

    def enter(self, *path):
        """
        Enters into sub meta data at the specified path. This always returns a
        new ``Meta`` object, regardless whether the path already exists.
        """
        return Meta(self._meta, path=self._path + map(six.text_type, path))

    def raw(self):
        """
        Returns the raw meta tree at the current path, if it exists; otherwise
        an empty object. This will contain both the meta data of the key ("")
        and sub meta trees.

        It is not safe to mutate the return value since it might be detached
        from the actual meta tree.
        """
        meta = self._meta
        for key in self._path:
            meta = meta.get(key) or {}
        return meta

    def get(self):
        """
        Returns meta data of the item at the current path, or an empty dict.

        It is not safe to mutate the return value since it might be detached
        from the actual meta tree.
        """
        return self.raw().get('') or {}

    def create(self):
        """
        Creates an empty meta data entry corresponding to the current path. This
        recursively creates the entire parent tree.
        """
        meta = self._meta
        for key in self._path + ['']:
            if key not in meta or meta[key] is None:
                meta[key] = {}
            meta = meta[key]

        return meta

    def merge(self, other):
        """
        Merges meta data of the given other ``Meta`` object into the current
        path.

        If no meta data entry exists for the current path, it is created, along
        with the entire parent tree.
        """
        other = other.get()
        if not other:
            return

        meta = self.create()
        err = meta.get('err')
        meta.update(other)

        if err and other.get('err'):
            meta['err'] = err + other['err']

    def get_errors(self):
        """
        Returns meta errors of the item at the current path.

        It is not safe to mutate the return value since it might be detached
        from the actual meta tree.
        """
        self.get().get('err') or []

    def add_error(self, error, value=None):
        """
        Adds an error to the meta data at the current path. The ``error``
        argument is converted to string. If the optional ``value`` is given, it
        is attached as original value into the meta data.

        If no meta data entry exists for the current path, it is created, along
        with the entire parent tree.
        """
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

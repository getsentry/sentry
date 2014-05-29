"""
sentry.search.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from collections import Sequence


class SearchResult(Sequence):
    def __init__(self, id_list=None, instances=None):
        assert not (id_list and instances), \
            'pass either id_list or instances, not both'
        self._id_list = id_list
        self._result_cache = instances

    def __len__(self):
        if self._result_cache is None:
            self._populate_result_cache()
        return len(self._result_cache)

    def __iter__(self):
        if self._result_cache is None:
            self._populate_result_cache()
        return iter(self._result_cache)

    def __getitem__(self, key):
        if self._result_cache is None:
            self._populate_result_cache()
        return self._result_cache[key]

    def __repr__(self):
        return '<%s: ids=%s>' % (type(self).__name__, self._id_list)

    def _populate_result_cache(self):
        from sentry.models import Group

        id_list = self._id_list
        group_map = Group.objects.in_bulk(id_list)

        results = []
        for g_id in id_list:
            try:
                results.append(group_map[g_id])
            except KeyError:
                pass

        self._result_cache = results


class SearchBackend(object):
    def __init__(self, **options):
        pass

    def index(self, event):
        raise NotImplementedError

    def query(self, project, query=None, status=None, tags=None,
              bookmarked_by=None, sort_by='date', date_filter='last_seen',
              date_from=None, date_to=None, offset=0, limit=100):
        raise NotImplementedError

    def upgrade(self):
        pass

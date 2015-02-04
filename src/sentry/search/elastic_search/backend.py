"""
sentry.search.elastic_search.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.


GET /_search
{
  'query': {
    'bool': {
      'must': [
        { 'match': {
            'title':  {
              'query': 'War and Peace',
              'boost': 2
        }}},
      ]
    }
  }
}

- has_child query
- curator (rotate indexes/etc)
- index templates
- allocate 50% memory to ES (needs file cache)
- aggregates/graph?
- allocation/routing for cluster key
- snapshots
- kopf plugin
- kibana/marvel

"""

from __future__ import absolute_import, print_function

from elasticsearch import Elasticsearch

from sentry.search.base import SearchBackend
from sentry.utils.cursors import CursorResult


class ElasticSearchBackend(SearchBackend):
    def __init__(self, hosts=None, index_prefix='', **options):
        self.index_prefix = index_prefix
        self.backend = Elasticsearch(hosts, **options)

    def _get_index(self, group):
        return self.index_prefix + 'sentry-1'

    def index(self, event):
        group = event.group

        data = {
            'message': group.message,
            'project_id': group.project_id,
            'first_seen': group.first_seen,
            'last_seen': group.last_seen,
            'times_seen': group.times_seen,
            'score': group.score,
            'status': group.status,
        }

        self.backend.index(
            index=self._get_index(group),
            doc_type='group',
            id=group.id,
            body=data,
        )

        data = dict(
            ('tag:{0}'.format(k), v)
            for k, v in event.get_tags()
        )

        self.backend.index(
            index=self._get_index(group),
            doc_type='event',
            id=event.event_id,
            body=data,
            parent=group.id,
        )

    def query(self, project, query=None, status=None, tags=None,
              bookmarked_by=None, assigned_to=None, sort_by='date',
              date_filter='last_seen', date_from=None, date_to=None,
              cursor=None, limit=100):

        query_body = {
            'filter': {
                'and': [
                    {'term': {'project_id': project.id}},
                ],
            },
        }
        if query:
            query_body['query'] = {'match': {'message': query}}

        if status is not None:
            query_body['filter']['and'].append({'term': {'status': status}})

        if tags:
            # TODO(dcramer): filter might be too expensive here, need to confirm
            query_body['filter']['and'].append({'has_child': {
                'type': 'event',
                'filter': {
                    'and': [
                        {'term': {'tag:{0}'.format(k): v}}
                        for k, v in tags.iteritems()
                    ]
                },
            }})

        # TODO(dcramer): filter might be too expensive here, need to confirm
        if date_to and date_from:
            query_body['filter']['and'].append({
                'range': {date_filter: {
                    'gte': date_from,
                    'lte': date_to,
                }}
            })
        elif date_from:
            query_body['filter']['and'].append({
                'range': {date_filter: {
                    'gte': date_from,
                }}
            })
        elif date_to:
            query_body['filter']['and'].append({
                'range': {date_filter: {
                    'lte': date_to,
                }}
            })

        if bookmarked_by:
            # TODO(dcramer): we could store an array on each event similar to how
            # we are doing tags? should we just make bookmarked events a special
            # thing that isn't searchable?
            raise NotImplementedError

        if assigned_to:
            # TODO(dcramer):
            raise NotImplementedError

        if sort_by == 'date':
            sort_clause = [{'last_seen': {'order': 'desc'}}]
        elif sort_by == 'new':
            sort_clause = [{'first_seen': {'order': 'desc'}}]
        elif sort_by == 'priority':
            sort_clause = [{'score': {'order': 'desc'}}]
        elif sort_by == 'freq':
            sort_clause = [{'times_seen': {'order': 'desc'}}]
        elif sort_by == 'tottime':
            raise NotImplementedError
        elif sort_by == 'avgtime':
            raise NotImplementedError
        else:
            raise ValueError('Invalid sort_by: %s' % (sort_by,))

        results = self.backend.search(
            index=self.index_prefix + 'sentry-1',
            doc_type='group',
            body={
                'query': {'filtered': query_body},
                'sort': sort_clause,
                'size': limit,
                # 'from': offset,
            },
        )
        if not results.get('hits'):
            return CursorResult(
                results=[],
                cursor=cursor,
                limit=limit,
            )

        instance_ids = [int(n['_id']) for n in results['hits']['hits']]

        return CursorResult.from_ids(
            id_list=instance_ids,
            cursor=cursor,
            limit=limit,
            # TODO(dcramer): implement cursors
            key=lambda x: x.id,
        )

    def upgrade(self):
        self.backend.indices.put_template(
            name='sentry',
            body={
                'template': self.index_prefix + 'sentry-*',
                'mappings': {
                    'group': {
                        '_source': {'enabled': False},
                        '_routing': {
                            'required': True,
                            'path': 'project_id',
                        },
                        'properties': {
                            'message': {
                                'type': 'string',
                            },
                            'project_id': {
                                'type': 'long',
                                'index': 'not_analyzed',
                            },
                            'first_seen': {
                                'type': 'date',
                            },
                            'last_seen': {
                                'type': 'date',
                            },
                        },
                    },
                    'event': {
                        '_source': {'enabled': False},
                        '_parent': {
                            'type': 'group',
                        },
                    }
                },
            },
        )

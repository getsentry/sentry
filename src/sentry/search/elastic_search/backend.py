'''
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

'''

from __future__ import absolute_import

from elasticsearch import Elasticsearch

from sentry.search.base import SearchBackend, SearchResult


class ElasticSearchBackend(SearchBackend):
    def __init__(self, hosts=None, index_prefix='', **options):
        self.index_prefix = index_prefix
        self.backend = Elasticsearch(hosts, **options)

    def _get_index(self, group):
        return self.index_prefix + 'sentry-1'

    def index(self, group, event):
        data = {
            'message': group.message,
            'project_id': group.project_id,
            'first_seen': group.first_seen,
            'last_seen': group.last_seen,
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
              bookmarked_by=None, sort_by='date', date_filter='last_seen',
              date_from=None, date_to=None, cursor=None):
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

        results = self.backend.search(
            index=self.index_prefix + 'sentry-1',
            doc_type='group',
            body={
                'query': {'filtered': query_body},
                'sort': [
                    {'last_seen': {'order': 'desc'}},
                ],
            },
        )
        if not results.get('hits'):
            return SearchResult([])
        return SearchResult([int(n['_id']) for n in results['hits']['hits']])

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
                    'event': {
                        '_source': {'enabled': False},
                        '_parent': {
                            'type': 'group',
                        },
                    }
                },
            },
        )

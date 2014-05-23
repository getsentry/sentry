"""
sentry.search.solr.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from collections import defaultdict
from nydus.db import create_cluster

from sentry.search.base import SearchBackend


class SolrBackend(SearchBackend):
    def __init__(self, servers, **options):
        self.backend = create_cluster({
            'engine': 'sentry.search.solr.client.Solr',
            'router': 'nydus.db.routers.base.RoundRobinRouter',
            'hosts': [{'url': u} for u in servers],
        })

    def index(self, group, event):
        self.backend.add([
            self._make_document(event),
        ])

    def remove(self, group):
        self.backend.delete(group.id)

    def _make_document(self, event):
        group = event.group

        context = {
            'text': [event.message],
            'filters': defaultdict(list),
        }

        tags = []
        for k, v in context['filters'].iteritems():
            tags.extend('%s=%s' % (k, f_v) for f_v in v)

        doc = {
            'id': '%s%s' % (event.project_id, event.event_id),
            'group': group.id,
            'project': group.project.id,
            'team': group.team.id,
            'datetime': event.datetime,
            'text': filter(bool, context['text']),
            'tags': tags,
        }

        return doc

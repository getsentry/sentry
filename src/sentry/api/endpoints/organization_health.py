from __future__ import absolute_import

from collections import namedtuple
from datetime import timedelta
from operator import or_
from six.moves import reduce

from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone

from sentry import roles
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
# from sentry.api.serializers import serialize
# from sentry.api.permissions import SuperuserPermission
from sentry.models import Project, ProjectStatus, Release
from sentry.utils import snuba


SnubaResultSet = namedtuple('SnubaResultSet', ('current', 'previous'))


def serialize_releases(organization, item_list, user):
    return {
        r.version: {
            'id': r.id,
            'version': r.version,
            'shortVersion': r.short_version,
        }
        for r in Release.objects.filter(
            organization=organization,
            version__in=item_list,
        )
    }


def serialize_eventusers(organization, item_list, user):
    # We have no reliable way to map the tag value format
    # back into real EventUser rows. EventUser is only unique
    # per-project, and this is an organization aggregate.
    # This means a single value maps to multiple rows.
    return {
        u: {
            'id': u,
            'type': u.split(':', 1)[0],
            'value': u.split(':', 1)[1],
        }
        for u in item_list
    }


def serialize_projects(organization, item_list, user):
    return {
        id: {
            'id': id,
            'slug': slug,
        }
        for id, slug in Project.objects.filter(
            id__in=item_list,
            organization=organization,
            status=ProjectStatus.VISIBLE,
        ).values_list('id', 'slug')
    }


class SnubaResultSerializer(object):
    def __init__(self, organization, tagkey, user):
        self.organization = organization
        self.tagkey = tagkey
        self.user = user
        self.name = tagkey_to_name[tagkey]

    def get_attrs(self, item_list):
        return serializer_by_tagkey[self.tagkey](self.organization, item_list, self.user)

    def serialize(self, result):
        counts_by_value = {
            r[self.tagkey]: r['count']
            for r in result.previous
        }
        projects = serialize_projects(
            self.organization,
            {p for r in result.current for p in r.get('top_projects', [])},
            self.user,
        )
        attrs = self.get_attrs(
            [r[self.tagkey] for r in result.current],
        )
        return {
            'data': [
                {
                    'count': r['count'],
                    'lastCount': counts_by_value.get(r[self.tagkey], 0),
                    'topProjects': [projects[p] for p in r.get('top_projects', [])],
                    'totalProjects': r.get('total_projects'),
                    self.name: attrs.get(r[self.tagkey]),
                }
                for r in result.current
            ],
        }


TAG_USER = 'tags[sentry:user]'
TAG_RELEASE = 'tags[sentry:release]'

aggregations_by_tagkey = {
    TAG_USER: [
        ('count()', '', 'count'),
        # ('topK(3)', 'project_id', 'top_projects'),
        # ('uniq', 'project_id', 'projects'),
    ],
    TAG_RELEASE: [
        ('count()', '', 'count'),
        ('topK(3)', 'project_id', 'top_projects'),
        ('uniq', 'project_id', 'total_projects'),
    ],
}

tagkey_to_name = {
    TAG_USER: 'user',
    TAG_RELEASE: 'release',
}

serializer_by_tagkey = {
    TAG_RELEASE: serialize_releases,
    TAG_USER: serialize_eventusers,
}


class OrganizationHealthEndpoint(OrganizationEndpoint):
    # permission_classes = (SuperuserPermission, )

    def empty(self):
        return Response({'data': []})

    def get(self, request, organization, page):
        period = int(request.GET.get('period', '7'))
        now = timezone.now()

        project_ids = list(
            Project.objects.filter(
                organization=organization,
                status=ProjectStatus.VISIBLE,
            ).values_list('id', flat=True)
        )

        # project_ids = range(1, 8)

        if not project_ids:
            return self.empty()

        tagkey = {
            'users': TAG_USER,
            'releases': TAG_RELEASE,
        }[page]
        aggregations = aggregations_by_tagkey[tagkey]

        data = snuba.raw_query(
            end=now,
            start=now - timedelta(days=period),
            aggregations=aggregations,
            filter_keys={
                'project_id': project_ids,
            },
            conditions=[
                [tagkey, 'IS NOT NULL', None],
            ],
            groupby=[tagkey],
            orderby='-count',
            limit=5,
            referrer='health',
        )['data']

        if not data:
            return self.empty()

        values = [r[tagkey] for r in data]

        previous = snuba.raw_query(
            end=now - timedelta(days=period),
            start=now - timedelta(days=period * 2),
            aggregations=[
                ('count()', '', 'count'),
            ],
            filter_keys={
                'project_id': project_ids,
            },
            conditions=[
                [tagkey, 'IN', values],
            ],
            groupby=[tagkey],
            referrer='health',
        )['data']

        serializer = SnubaResultSerializer(organization, tagkey, request.user)
        return Response(
            serializer.serialize(
                SnubaResultSet(data, previous),
            ),
            status=200,
        )

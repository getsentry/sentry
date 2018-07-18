from __future__ import absolute_import

import six
from functools import reduce
from operator import or_

from django.db.models import Q

from sentry.models import Release, Project, ProjectStatus, EventUser


def serialize_releases(organization, item_list, user):
    return {
        (r.version,): {
            'id': r.id,
            'version': r.version,
            'shortVersion': r.short_version,
        }
        for r in Release.objects.filter(
            organization=organization,
            version__in=[i[0] for i in item_list],
        )
    }


def serialize_eventusers(organization, item_list, user):
    # We have no reliable way to map the tag value format
    # back into real EventUser rows. EventUser is only unique
    # per-project, and this is an organization aggregate.
    # This means a single value maps to multiple rows.
    filters = reduce(or_, [
        Q(hash=EventUser.hash_from_tag(tag), project_id=project)
        for tag, project in item_list
    ])

    eu_by_key = {
        (eu.tag_value, eu.project_id): eu
        for eu in EventUser.objects.filter(filters)
    }

    rv = {}
    for tag, project in item_list:
        eu = eu_by_key.get((tag, project))
        if eu is None:
            attr, value = tag.split(':', 1)
            eu = EventUser(project_id=project, **{EventUser.attr_from_keyword(attr): value})
        rv[(tag, project)] = {
            'id': six.text_type(eu.id) if eu.id else None,
            'project_id': eu.project_id,
            'hash': eu.hash,
            'tagValue': eu.tag_value,
            'identifier': eu.ident,
            'username': eu.username,
            'email': eu.email,
            'ipAddress': eu.ip_address,
            'dateCreated': eu.date_added,
            'label': eu.get_label(),
            'name': eu.get_display_name(),
        }
    return rv


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


def value_from_row(row, tagkey):
    return tuple(row[k] for k in tagkey)


TAG_USER = ('tags[sentry:user]', 'project_id')
TAG_RELEASE = ('tags[sentry:release]',)

serializer_by_tagkey = {
    TAG_RELEASE: serialize_releases,
    TAG_USER: serialize_eventusers,
}

tagkey_to_name = {
    TAG_USER: 'user',
    TAG_RELEASE: 'release',
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
            value_from_row(r, self.tagkey): r['count']
            for r in result.previous
        }
        projects = serialize_projects(
            self.organization,
            {p for r in result.current for p in r.get('top_projects', [])},
            self.user,
        )
        attrs = self.get_attrs(
            [value_from_row(r, self.tagkey) for r in result.current],
        )

        data = []
        for r in result.current:
            value = value_from_row(r, self.tagkey)
            row = {
                'count': r['count'],
                'lastCount': counts_by_value.get(value, 0),
                self.name: attrs.get(value),
            }
            if 'top_projects' in r:
                row['topProjects'] = [projects[p] for p in r['top_projects']]
            if 'total_projects' in r:
                row['totalProjects'] = r['total_projects']

            data.append(row)

        return {'data': data}

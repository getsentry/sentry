from __future__ import absolute_import

import six
import itertools
from functools import reduce
from operator import or_

from django.db.models import Q

from sentry.models import Release, Project, ProjectStatus, EventUser
from sentry.utils.dates import to_timestamp


def serialize_releases(organization, item_list, user):
    return {
        (r.version,): {
            'id': r.id,
            'version': r.version,
            'shortVersion': r.short_version,
        }
        for r in Release.objects.filter(
            organization=organization,
            version__in={i[0] for i in item_list},
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

    projects = serialize_projects(organization, {i[1] for i in item_list}, user)

    rv = {}
    for tag, project in item_list:
        eu = eu_by_key.get((tag, project))
        if eu is None:
            attr, value = tag.split(':', 1)
            eu = EventUser(project_id=project, **{EventUser.attr_from_keyword(attr): value})
        rv[(tag, project)] = {
            'id': six.text_type(eu.id) if eu.id else None,
            'project': projects.get(eu.project_id),
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


def serialize_noop(organization, item_list, user):
    return {i: i for i in item_list}


def value_from_row(row, tagkey):
    return tuple(row[k] for k in tagkey)


def zerofill(data, start, end, rollup):
    rv = []
    start = ((int(to_timestamp(start)) / rollup) * rollup) + rollup
    end = ((int(to_timestamp(end)) / rollup) * rollup) + rollup
    i = 0
    for key in xrange(start, end, rollup):
        try:
            if data[i][0] == key:
                rv.append(data[i])
                i += 1
                continue
        except IndexError:
            pass

        rv.append((key, []))
    return rv


TAG_USER = ('tags[sentry:user]', 'project_id')
TAG_RELEASE = ('tags[sentry:release]',)
TAG_BROWSER_NAME = ('tags[browser.name]',)
TAG_OS_NAME = ('tags[os.name]',)

serializer_by_tagkey = {
    TAG_RELEASE: serialize_releases,
    TAG_USER: serialize_eventusers,
}

tagkey_to_name = {
    TAG_USER: 'user',
    TAG_RELEASE: 'release',
    TAG_BROWSER_NAME: 'browser.name',
    TAG_OS_NAME: 'os.name',
}


class SnubaSerializer(object):
    def __init__(self, organization, tagkey, user):
        self.organization = organization
        self.tagkey = tagkey
        self.user = user
        self.name = tagkey_to_name[tagkey]

    def get_attrs(self, item_list):
        return serializer_by_tagkey.get(self.tagkey, serialize_noop)(
            self.organization, item_list, self.user)


class SnubaResultSerializer(SnubaSerializer):
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


class SnubaTSResultSerializer(SnubaSerializer):

    def serialize(self, result):
        data = [
            (key, list(group))
            for key, group in itertools.groupby(result.data, key=lambda r: r['time'])
        ]
        attrs = self.get_attrs([
            value_from_row(r, self.tagkey)
            for _, v in data
            for r in v
        ])
        rv = []
        for k, v in data:
            row = []
            for r in v:
                value = value_from_row(r, self.tagkey)
                row.append({
                    'count': r['count'],
                    self.name: attrs.get(value),
                })
            rv.append((k, row))
        return {'data': zerofill(rv, result.start, result.end, result.rollup)}

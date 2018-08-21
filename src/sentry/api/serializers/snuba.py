from __future__ import absolute_import

import six
import itertools
from functools import reduce
from operator import or_

from django.db.models import Q

from sentry.models import Release, Project, ProjectStatus, EventUser
from sentry.utils.dates import to_timestamp
from sentry.utils.geo import geo_by_addr as _geo_by_addr


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


def geo_by_addr(ip):
    try:
        geo = _geo_by_addr(ip)
    except Exception:
        geo = None

    if not geo:
        return

    rv = {}
    for k in 'country_code', 'city', 'region':
        d = geo.get(k)
        if isinstance(d, six.binary_type):
            d = d.decode('ISO-8859-1')
        rv[k] = d

    return rv


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
            'geo': geo_by_addr(eu.ip_address),
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
    return {i: i[0] for i in item_list}


def value_from_row(row, tagkey):
    return tuple(row[k] for k in tagkey)


def zerofill(data, start, end, rollup):
    rv = []
    start = ((int(to_timestamp(start)) / rollup) * rollup) - rollup
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


class SnubaLookup(object):
    __slots__ = 'name', 'tagkey', 'columns', 'selected_columns', 'conditions', 'serializer'
    __registry = {}

    def __init__(self, name, tagkey=None, extra=None, selected_columns=None,
                 conditions=None, serializer=serialize_noop):
        cls = type(self)
        assert name not in cls.__registry
        self.name = name
        self.tagkey = tagkey or name
        self.columns = [self.tagkey] + list(extra or [])
        self.serializer = serializer
        self.conditions = conditions or [[self.tagkey, 'IS NOT NULL', None]]
        self.selected_columns = selected_columns or []
        cls.__registry[name] = self

    @classmethod
    def get(cls, name):
        return cls.__registry[name]


SnubaLookup('user', 'tags[sentry:user]', ['project_id'], serializer=serialize_eventusers)
SnubaLookup('release', 'tags[sentry:release]', serializer=serialize_releases)
SnubaLookup('os.name', 'tags[os.name]')
SnubaLookup('browser.name', 'tags[browser.name]', conditions=[])
SnubaLookup('error.type', 'error_type', selected_columns=[
    ('emptyIfNull', ('arrayElement', ('exception_stacks.type', 1)), 'error_type'),
], conditions=[
    [('notEmpty', ('exception_stacks.type',)), '=', 1],
    [('error_type', '!=', '')],
])
SnubaLookup('error.handled', 'error_handled', selected_columns=[
    ('arrayElement', ('exception_stacks.mechanism_handled', 1), 'error_handled'),
], conditions=[
    [('notEmpty', ('exception_stacks.mechanism_handled',)), '=', 1],
])


class SnubaSerializer(object):
    def __init__(self, organization, lookup, user):
        self.organization = organization
        self.lookup = lookup
        self.user = user

    def get_attrs(self, item_list):
        return self.lookup.serializer(
            self.organization, item_list, self.user)


class SnubaResultSerializer(SnubaSerializer):
    def serialize(self, result):
        counts_by_value = {
            value_from_row(r, self.lookup.columns): r['count']
            for r in result.previous['data']
        }
        projects = serialize_projects(
            self.organization,
            {p for r in result.current['data'] for p in r.get('top_projects', [])},
            self.user,
        )
        attrs = self.get_attrs(
            [value_from_row(r, self.lookup.columns) for r in result.current['data']],
        )

        data = []
        for r in result.current['data']:
            value = value_from_row(r, self.lookup.columns)
            row = {
                'count': r['count'],
                'lastCount': counts_by_value.get(value, 0),
                self.lookup.name: attrs.get(value),
            }
            if 'top_projects' in r:
                row['topProjects'] = [projects[p] for p in r['top_projects']]
            if 'total_projects' in r:
                row['totalProjects'] = r['total_projects']

            data.append(row)

        return {
            'data': data,
            'totals': {
                'count': result.current['totals']['count'],
                'lastCount': result.previous['totals']['count'],
            },
        }


class SnubaTSResultSerializer(SnubaSerializer):

    def serialize(self, result):
        data = [
            (key, list(group))
            for key, group in itertools.groupby(result.data['data'], key=lambda r: r['time'])
        ]
        attrs = self.get_attrs([
            value_from_row(r, self.lookup.columns)
            for _, v in data
            for r in v
        ])
        rv = []
        for k, v in data:
            row = []
            for r in v:
                value = value_from_row(r, self.lookup.columns)
                row.append({
                    'count': r['count'],
                    self.lookup.name: attrs.get(value),
                })
            rv.append((k, row))
        return {
            'data': zerofill(rv, result.start, result.end, result.rollup),
            'totals': {'count': result.data['totals']['count']},
        }

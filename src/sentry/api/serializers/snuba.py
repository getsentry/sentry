from __future__ import absolute_import

from sentry.models import Release, Project, ProjectStatus


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


TAG_USER = 'tags[sentry:user]'
TAG_RELEASE = 'tags[sentry:release]'

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

from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Environment, Release, ReleaseEnvironment, TagValue


@register(Release)
class ReleaseSerializer(Serializer):
    def get_attrs(self, item_list, user):
        tags = {
            tk.value: tk
            for tk in TagValue.objects.filter(
                project=item_list[0].project,
                key='sentry:release',
                value__in=[o.version for o in item_list],
            )
        }
        owners = {
            d['id']: d
            for d in serialize(set(i.owner for i in item_list if i.owner_id), user)
        }

        result = {}
        for item in item_list:
            result[item] = {
                'tag': tags.get(item.version),
                'owner': owners[six.text_type(item.owner_id)] if item.owner_id else None,
            }
        return result

    def serialize(self, obj, attrs, user):
        d = {
            'version': obj.version,
            'shortVersion': obj.short_version,
            'ref': obj.ref,
            'url': obj.url,
            'dateStarted': obj.date_started,
            'dateReleased': obj.date_released,
            'dateCreated': obj.date_added,
            'data': obj.data,
            'newGroups': obj.new_groups,
            'owner': attrs['owner'],
        }
        if attrs['tag']:
            d.update({
                'lastEvent': attrs['tag'].last_seen,
                'firstEvent': attrs['tag'].first_seen,
            })
        else:
            d.update({
                'lastEvent': None,
                'firstEvent': None,
            })
        return d


class DetailedReleaseSerializer(ReleaseSerializer):
    def serialize(self, obj, attrs, user):
        rel_envs = ReleaseEnvironment.objects.filter(
            release_id=obj.id,
        ).order_by('last_seen')[:25]

        env_id_map = dict(Environment.objects.filter(
            project_id=obj.project_id,
            id__in=[r.environment_id for r in rel_envs],
        ).values_list('id', 'name'))

        d = super(DetailedReleaseSerializer, self).serialize(obj, attrs, user)
        d['environments'] = sorted(({
            'id': six.text_type(re.environment_id),
            'name': env_id_map.get(re.environment_id, 'unknown'),
            'firstSeen': re.first_seen,
            'lastSeen': re.last_seen,
        } for re in rel_envs), key=lambda x: x['name'])

        return d

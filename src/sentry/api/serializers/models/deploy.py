from __future__ import absolute_import

from collections import defaultdict

from sentry.api.serializers import Serializer, register
from sentry.models import Deploy, DeployResource, Environment


@register(Deploy)
class DeploySerializer(Serializer):
    def get_attrs(self, item_list, user, *args, **kwargs):
        environments = {
            e.id: e
            for e in Environment.objects.filter(
                id__in=[d.environment_id for d in item_list]
            )
        }

        resources = {
            r.id: r
            for r in DeployResource.objects.filter(deploys__in=item_list)
        }
        resources_by_deploy = defaultdict(list)
        for dr_rel in Deploy.resources.through.objects.filter(deploy__in=item_list):
            resources_by_deploy[dr_rel.deploy_id].append(resources[dr_rel.deployresource_id])

        result = {}
        for item in item_list:
            result[item] = {
                'environment': environments.get(item.environment_id),
                'resources': resources_by_deploy.get(item.id)
            }

        return result

    def serialize(self, obj, attrs, user, *args, **kwargs):
        d = {
            'environment': attrs.get('environment'),
            'dateStarted': obj.date_started,
            'dateFinished': obj.date_finished,
            'name': obj.name,
            'url': obj.url,
            'resources': attrs.get('resources'),
        }
        if attrs.get('environment'):
            d['environment'] = attrs['environment'].name
        if attrs.get('resources'):
            d['resources'] = [r.name for r in attrs['resources']]
        return d

from __future__ import absolute_import

import six

from sentry.api.serializers import register, Serializer
from sentry.models import Integration


@register(Integration)
class IntegrationSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        provider = obj.get_provider()
        return {
            'id': six.text_type(obj.id),
            'name': obj.name,
            'icon': obj.metadata.get('icon'),
            'domain_name': obj.metadata.get('domain_name'),
            'provider': {
                'key': provider.key,
                'name': provider.name,
            }
        }


class IntegrationIssueSerializer(IntegrationSerializer):
    def __init__(self, group, action):
        self.group = group
        self.action = action

    def serialize(self, obj, attrs, user):
        data = super(IntegrationIssueSerializer, self).serialize(obj, attrs, user)
        installation = obj.get_installation()

        if self.action == 'link':
            data['linkIssueConfig'] = installation.get_link_issue_config(self.group)

        return data

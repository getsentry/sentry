from __future__ import absolute_import

import six
from collections import defaultdict

from sentry.api.serializers import register, Serializer
from sentry.models import ExternalIssue, GroupLink, Integration


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


class IntegrationIssueConfigSerializer(IntegrationSerializer):
    def __init__(self, group, action):
        self.group = group
        self.action = action

    def serialize(self, obj, attrs, user):
        data = super(IntegrationIssueConfigSerializer, self).serialize(obj, attrs, user)
        installation = obj.get_installation()

        if self.action == 'link':
            data['linkIssueConfig'] = installation.get_link_issue_config(self.group)

        return data


class IntegrationIssueSerializer(IntegrationSerializer):
    def __init__(self, group):
        self.group = group

    def get_attrs(self, item_list, user, *args, **kwargs):
        external_issues = ExternalIssue.objects.filter(
            id__in=GroupLink.objects.filter(
                group_id=self.group.id,
                project_id=self.group.project_id,
                linked_type=GroupLink.LinkedType.issue,
                relationship=GroupLink.Relationship.references,
            ).values_list('linked_id', flat=True),
            integration_id__in=[i.id for i in item_list],
        )

        issues_by_integration = defaultdict(list)
        for ei in external_issues:
            # TODO(jess): move into an external issue serializer?
            issues_by_integration[ei.integration_id].append({
                'id': six.text_type(ei.id),
                'key': ei.key,
                'title': ei.title,
                'description': ei.description,
            })

        return {
            item: {
                'external_issues': issues_by_integration.get(item.id, [])
            } for item in item_list
        }

    def serialize(self, obj, attrs, user):
        data = super(IntegrationIssueSerializer, self).serialize(obj, attrs, user)
        data['externalIssues'] = attrs.get('external_issues', [])
        return data

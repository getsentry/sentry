from __future__ import absolute_import

from sentry.api.serializers import Serializer, register, serialize
from sentry.auth import access
from sentry.models import (
    Organization, OrganizationAccessRequest, Team, TeamStatus
)


@register(Organization)
class OrganizationSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
        }


class DetailedOrganizationSerializer(OrganizationSerializer):
    def serialize(self, obj, attrs, user):
        from sentry import features
        from sentry.api.serializers.models.team import TeamWithProjectsSerializer

        team_list = list(Team.objects.filter(
            organization=obj,
            status=TeamStatus.VISIBLE,
        ))

        feature_list = []
        if features.has('organizations:sso', obj, actor=user):
            feature_list.append('sso')

        if getattr(obj.flags, 'allow_joinleave'):
            feature_list.append('open-membership')

        context = super(DetailedOrganizationSerializer, self).serialize(
            obj, attrs, user)
        context['teams'] = serialize(
            team_list, user, TeamWithProjectsSerializer())
        context['access'] = access.from_user(user, obj).scopes
        context['features'] = feature_list
        context['pendingAccessRequests'] = OrganizationAccessRequest.objects.filter(
            team__organization=obj,
        ).count()
        return context

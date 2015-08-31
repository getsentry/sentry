from __future__ import absolute_import

from sentry.api.serializers import Serializer, register, serialize
from sentry.auth import access
from sentry.models import (
    Organization, OrganizationAccessRequest, OrganizationMember,
    OrganizationMemberType, Team, TeamStatus
)


@register(Organization)
class OrganizationSerializer(Serializer):
    def get_attrs(self, item_list, user):
        if user.is_authenticated():
            member_map = dict(
                (om.organization_id, om)
                for om in OrganizationMember.objects.filter(
                    organization__in=item_list,
                    user=user,
                )
            )
        else:
            member_map = {}

        result = {}
        for organization in item_list:
            try:
                om = member_map[organization.id]
            except KeyError:
                if user.is_superuser:
                    is_global = True
                    access_type = OrganizationMemberType.OWNER
                else:
                    is_global = False
                    access_type = None
            else:
                is_global = om.has_global_access
                access_type = om.type

            result[organization] = {
                'is_global': is_global,
                'access_type': access_type,
            }
        return result

    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
            'isGlobal': attrs['is_global'],
            'permission': {
                'owner': attrs['access_type'] <= OrganizationMemberType.OWNER,
                'admin': attrs['access_type'] <= OrganizationMemberType.ADMIN,
            }
        }
        return d


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

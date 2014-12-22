from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import (
    Organization, OrganizationMember, OrganizationMemberType
)


@register(Organization)
class OrganizationSerializer(Serializer):
    def get_attrs(self, item_list, user):
        member_map = dict(
            (om.organization_id, om)
            for om in OrganizationMember.objects.filter(
                organization__in=item_list,
                user=user,
            )
        )

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

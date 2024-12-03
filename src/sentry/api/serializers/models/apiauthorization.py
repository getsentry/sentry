from sentry.api.serializers import Serializer, register, serialize
from sentry.models.apiauthorization import ApiAuthorization
from sentry.organizations.services.organization import organization_service


@register(ApiAuthorization)
class ApiAuthorizationSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        apps = {
            d["id"]: d
            for d in serialize({i.application for i in item_list if i.application_id}, user)
        }

        attrs = {}
        for item in item_list:
            attrs[item] = {
                "application": (apps.get(item.application.client_id) if item.application else None)
            }
        return attrs

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "scopes": obj.get_scopes(),
            "application": attrs["application"],
            "dateCreated": obj.date_added,
            "organization": (
                organization_service.serialize_organization(id=obj.organization_id)
                if obj.organization_id
                else None
            ),
        }

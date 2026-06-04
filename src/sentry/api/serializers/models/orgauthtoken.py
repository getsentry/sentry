from sentry.api.serializers import Serializer, register
from sentry.models.orgauthtoken import OrgAuthToken


@register(OrgAuthToken)
class OrgAuthTokenSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        token = kwargs["token"]
        data = {
            "id": str(obj.id),
            "name": obj.name,
            "scopes": obj.get_scopes(),
            "tokenLastCharacters": obj.token_last_characters,
            "dateCreated": obj.date_added,
            "dateLastUsed": obj.date_last_used,
            "projectLastUsedId": (
                str(obj.project_last_used_id) if obj.project_last_used_id else None
            ),
        }

        if token:
            data["token"] = token

        return data

from sentry.api.serializers import Serializer, register, serialize
from sentry.models.apitoken import ApiToken


@register(ApiToken)
class ApiTokenSerializer(Serializer):
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
        data = {
            "id": str(obj.id),
            "scopes": obj.get_scopes(),
            "name": obj.name,
            "application": attrs["application"],
            "expiresAt": obj.expires_at,
            "dateCreated": obj.date_added,
            "state": attrs.get("state"),
        }
        if not attrs["application"]:
            include_token = kwargs.get("include_token", True)
            if include_token:
                data["token"] = obj.token

            data["refreshToken"] = obj.refresh_token

        """
        While this is a nullable column at the db level, this should never be empty. If it is, it's a sign that the
        token was created through improper channels, and might actually be invalid. If that's the case, it can be
        considered a security risk, and better for this to throw an exception than to leak a dangerous token.
        """
        data["tokenLastCharacters"] = obj.token_last_characters
        return data

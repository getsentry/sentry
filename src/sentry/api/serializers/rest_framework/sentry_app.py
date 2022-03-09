from jsonschema.exceptions import ValidationError as SchemaValidationError
from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.api.fields.avatar import AvatarField
from sentry.api.serializers.rest_framework import ListField
from sentry.api.serializers.rest_framework.base import camel_to_snake_case
from sentry.api.validators.sentry_apps.schema import validate_ui_element_schema
from sentry.models import ApiScopes
from sentry.models.integrations.integration_feature import Feature
from sentry.models.integrations.sentry_app import (
    REQUIRED_EVENT_PERMISSIONS,
    UUID_CHARS_IN_SLUG,
    VALID_EVENT_RESOURCES,
)
from sentry.utils.avatar import is_black_alpha_only


class ApiScopesField(serializers.Field):
    def to_internal_value(self, data):
        valid_scopes = ApiScopes()

        if data is None:
            return

        for scope in data:
            if scope not in valid_scopes:
                raise ValidationError(f"{scope} not a valid scope")
        return data


class EventListField(serializers.Field):
    def to_internal_value(self, data):
        if data is None:
            return

        if not set(data).issubset(VALID_EVENT_RESOURCES):
            raise ValidationError(
                "Invalid event subscription: {}".format(
                    ", ".join(set(data).difference(VALID_EVENT_RESOURCES))
                )
            )
        return data


class SchemaField(serializers.Field):
    def to_internal_value(self, data):
        if data is None:
            return

        if data == "" or data == {}:
            return {}

        try:
            validate_ui_element_schema(data, self.context["features"])
        except SchemaValidationError as e:
            raise ValidationError(e.message)  # noqa: B306

        return data


class URLField(serializers.URLField):
    def to_internal_value(self, url):
        # The Django URLField doesn't distinguish between different types of
        # invalid URLs, so do any manual checks here to give the User a better
        # error message.
        if url and not url.startswith("http"):
            raise ValidationError("URL must start with http[s]://")
        return url


class SentryAppSerializer(Serializer):
    name = serializers.CharField()
    author = serializers.CharField(required=False, allow_null=True)
    scopes = ApiScopesField(allow_null=True)
    status = serializers.CharField(required=False, allow_null=True)
    events = EventListField(required=False, allow_null=True)
    features = serializers.MultipleChoiceField(
        choices=Feature.as_choices(), allow_blank=True, allow_null=True, required=False
    )
    schema = SchemaField(required=False, allow_null=True)
    webhookUrl = URLField(required=False, allow_null=True, allow_blank=True)
    redirectUrl = URLField(required=False, allow_null=True, allow_blank=True)
    isInternal = serializers.BooleanField(required=False, default=False)
    isAlertable = serializers.BooleanField(required=False, default=False)
    overview = serializers.CharField(required=False, allow_null=True)
    verifyInstall = serializers.BooleanField(required=False, default=True)
    allowedOrigins = ListField(child=serializers.CharField(max_length=255), required=False)
    # Bounds chosen to match PositiveSmallIntegerField (https://docs.djangoproject.com/en/3.2/ref/models/fields/#positivesmallintegerfield)
    popularity = serializers.IntegerField(
        min_value=0,
        max_value=32767,
        required=False,
        allow_null=True,
    )

    def __init__(self, *args, **kwargs):
        self.access = kwargs["access"]
        del kwargs["access"]
        Serializer.__init__(self, *args, **kwargs)

    # an abstraction to pull fields from attrs if they are available or the sentry_app if not
    def get_current_value_wrapper(self, attrs):
        def get_current_value(field_name):
            if field_name in attrs:
                return attrs[field_name]
            # params might be passed as camel case but we always store as snake case
            mapped_field_name = camel_to_snake_case(field_name)
            if hasattr(self.instance, mapped_field_name):
                return getattr(self.instance, mapped_field_name)
            else:
                return None

        return get_current_value

    def validate_name(self, value):
        max_length = 64 - UUID_CHARS_IN_SLUG - 1  # -1 comes from the - before the UUID bit
        if len(value) > max_length:
            raise ValidationError("Cannot exceed %d characters" % max_length)
        return value

    def validate_allowedOrigins(self, value):
        for allowed_origin in value:
            if "*" in allowed_origin:
                raise ValidationError("'*' not allowed in origin")
        return value

    def validate_scopes(self, value):
        if not value:
            return value

        validation_errors = []
        for scope in value:
            # if the existing instance already has this scope, skip the check
            if self.instance and self.instance.has_scope(scope):
                continue
            # add an error if the requester lacks permissions being requested
            if not self.access.has_scope(scope):
                validation_errors.append(
                    "Requested permission of %s exceeds requester's permission. Please contact an administrator to make the requested change."
                    % (scope)
                )

        if validation_errors:
            raise ValidationError(validation_errors)

        return value

    def validate(self, attrs):
        # validates events against scopes
        if attrs.get("scopes"):
            for resource in attrs.get("events", []):
                needed_scope = REQUIRED_EVENT_PERMISSIONS[resource]
                if needed_scope not in attrs["scopes"]:
                    raise ValidationError(
                        {"events": f"{resource} webhooks require the {needed_scope} permission."}
                    )

        get_current_value = self.get_current_value_wrapper(attrs)
        # validate if webhookUrl is missing that we don't have any webhook features enabled
        if not get_current_value("webhookUrl"):
            if get_current_value("isInternal"):
                # for internal apps, make sure there aren't any events if webhookUrl is null
                if get_current_value("events"):
                    raise ValidationError(
                        {"webhookUrl": "webhookUrl required if webhook events are enabled"}
                    )
                # also check that we don't have the alert rule enabled
                if get_current_value("isAlertable"):
                    raise ValidationError(
                        {"webhookUrl": "webhookUrl required if alert rule action is enabled"}
                    )
            else:
                raise ValidationError({"webhookUrl": "webhookUrl required for public integrations"})

        # validate author for public integrations
        if not get_current_value("isInternal") and not get_current_value("author"):
            raise ValidationError({"author": "author required for public integrations"})

        return attrs


class SentryAppAvatarSerializer(Serializer):
    avatar_photo = AvatarField(required=False, is_sentry_app=True)
    avatar_type = serializers.ChoiceField(choices=(("default", "default"), ("upload", "upload")))
    color = serializers.BooleanField(required=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if attrs.get("avatar_type") == "upload" and not attrs.get("avatar_photo"):
            raise serializers.ValidationError({"avatar_photo": "A logo is required."})

        if (
            not attrs.get("color")
            and attrs.get("avatar_type") == "upload"
            and not is_black_alpha_only(attrs.get("avatar_photo"))
        ):
            raise serializers.ValidationError(
                {
                    "avatar_photo": "The icon must only use black and should contain an alpha channel."
                }
            )

        return attrs

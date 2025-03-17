from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from jsonschema.exceptions import ValidationError as SchemaValidationError
from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.api.serializers.rest_framework.base import camel_to_snake_case
from sentry.apidocs.parameters import build_typed_list
from sentry.integrations.models.integration_feature import Feature
from sentry.models.apiscopes import ApiScopes
from sentry.sentry_apps.api.parsers.schema import validate_ui_element_schema
from sentry.sentry_apps.models.sentry_app import (
    REQUIRED_EVENT_PERMISSIONS,
    UUID_CHARS_IN_SLUG,
    VALID_EVENT_RESOURCES,
)


@extend_schema_field(build_typed_list(OpenApiTypes.STR))
class ApiScopesField(serializers.Field):
    def to_internal_value(self, data):
        valid_scopes = ApiScopes()

        if data is None:
            return

        for scope in data:
            if scope not in valid_scopes:
                raise ValidationError(f"{scope} not a valid scope")
        return data


@extend_schema_field(build_typed_list(OpenApiTypes.STR))
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


@extend_schema_field(OpenApiTypes.OBJECT)
class SchemaField(serializers.Field):
    def to_internal_value(self, data):
        if data is None:
            return

        if data == "" or data == {}:
            return {}

        try:
            validate_ui_element_schema(data)
        except SchemaValidationError as e:
            raise ValidationError(e.message)

        return data


class URLField(serializers.URLField):
    def to_internal_value(self, url):
        # The Django URLField doesn't distinguish between different types of
        # invalid URLs, so do any manual checks here to give the User a better
        # error message.
        if url and not url.startswith("http"):
            raise ValidationError("URL must start with http[s]://")
        return url


@extend_schema_serializer(exclude_fields=["popularity", "features", "status"])
class SentryAppParser(Serializer):
    name = serializers.CharField(help_text="The name of the custom integration.")
    author = serializers.CharField(
        required=False, allow_null=True, help_text="The custom integration's author."
    )
    scopes = ApiScopesField(
        allow_null=True, help_text="The custom integration's permission scopes for API access."
    )
    status = serializers.CharField(
        required=False, allow_null=True, help_text="The custom integration's status."
    )
    events = EventListField(
        required=False,
        allow_null=True,
        help_text="Webhook events the custom integration is subscribed to.",
    )
    features = serializers.MultipleChoiceField(
        choices=Feature.as_choices(),
        allow_blank=True,
        allow_null=True,
        required=False,
        help_text="The list of features that the custom integration supports.",
    )
    schema = SchemaField(
        required=False,
        allow_null=True,
        help_text="The UI components schema, used to render the custom integration's configuration UI elements. See our [schema docs](https://docs.sentry.io/organization/integrations/integration-platform/ui-components/) for more information.",
    )
    webhookUrl = URLField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="The webhook destination URL.",
    )
    redirectUrl = URLField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="The post-installation redirect URL.",
    )
    isInternal = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether or not the integration is internal only. False means the integration is public.",
    )
    isAlertable = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Marks whether or not the custom integration can be used in an alert rule.",
    )
    overview = serializers.CharField(
        required=False, allow_null=True, help_text="The custom integration's description."
    )
    verifyInstall = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Whether or not an installation of the custom integration should be verified.",
    )
    allowedOrigins = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        help_text="The list of allowed origins for CORS.",
    )
    # Bounds chosen to match PositiveSmallIntegerField (https://docs.djangoproject.com/en/3.2/ref/models/fields/#positivesmallintegerfield)
    popularity = serializers.IntegerField(
        min_value=0,
        max_value=32767,
        required=False,
        allow_null=True,
    )

    def __init__(self, *args, **kwargs):
        self.active_staff = kwargs.pop("active_staff", False)
        self.access = kwargs.pop("access", None)
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

            assert (
                self.access is not None
            ), "Access is required to validate scopes in SentryAppParser"
            # add an error if the requester lacks permissions being requested
            if not self.access.has_scope(scope) and not self.active_staff:
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

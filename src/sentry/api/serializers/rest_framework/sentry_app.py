from __future__ import absolute_import

from jsonschema.exceptions import ValidationError as SchemaValidationError

from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from django.template.defaultfilters import slugify
from sentry.api.validators.sentry_apps.schema import validate as validate_schema
from sentry.models import ApiScopes, SentryApp
from sentry.models.sentryapp import VALID_EVENT_RESOURCES, REQUIRED_EVENT_PERMISSIONS


class ApiScopesField(serializers.Field):
    def to_internal_value(self, data):
        valid_scopes = ApiScopes()

        if not data:
            return

        for scope in data:
            if scope not in valid_scopes:
                raise ValidationError(u"{} not a valid scope".format(scope))
        return data


class EventListField(serializers.Field):
    def to_internal_value(self, data):
        if data is None:
            return

        if not set(data).issubset(VALID_EVENT_RESOURCES):
            raise ValidationError(
                u"Invalid event subscription: {}".format(
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
            validate_schema(data)
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


class SentryAppSerializer(Serializer):
    name = serializers.CharField()
    author = serializers.CharField()
    scopes = ApiScopesField(allow_null=True)
    status = serializers.CharField(required=False, allow_null=True)
    events = EventListField(required=False, allow_null=True)
    schema = SchemaField(required=False, allow_null=True)
    webhookUrl = URLField(required=False, allow_null=True, allow_blank=True)
    redirectUrl = URLField(required=False, allow_null=True, allow_blank=True)
    isAlertable = serializers.BooleanField(required=False, default=False)
    isInternal = serializers.BooleanField()
    overview = serializers.CharField(required=False, allow_null=True)
    verifyInstall = serializers.BooleanField(required=False, default=True)

    def validate_name(self, value):
        if not value:
            return value

        queryset = SentryApp.with_deleted.filter(slug=slugify(value))

        if self.instance:
            queryset = queryset.exclude(id=self.instance.id)

        if queryset.exists():
            raise ValidationError(u"Name {} is already taken, please use another.".format(value))
        return value

    def validate(self, attrs):
        # validates events against scopes
        if attrs.get("scopes"):
            for resource in attrs.get("events"):
                needed_scope = REQUIRED_EVENT_PERMISSIONS[resource]
                if needed_scope not in attrs["scopes"]:
                    raise ValidationError(
                        {
                            "events": u"{} webhooks require the {} permission.".format(
                                resource, needed_scope
                            )
                        }
                    )

        # validate if webhookUrl is missing that we don't have any webhook features enabled
        if not attrs.get("webhookUrl"):
            if attrs.get("isInternal"):
                # for internal apps, make sure there aren't any events if webhookUrl is null
                if attrs.get("events") and len(attrs.get("events")) > 0:
                    raise ValidationError(
                        {"webhookUrl": "webhookUrl required if webhook events are enabled"}
                    )
                # also check that we don't have the alert rule enabled
                if attrs.get("isAlertable"):
                    raise ValidationError(
                        {"webhookUrl": "webhookUrl required if alert rule action is enabled"}
                    )

            else:
                raise ValidationError({"webhookUrl": "webhookUrl required for public integrations"})

        return attrs

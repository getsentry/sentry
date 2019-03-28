from __future__ import absolute_import

from jsonschema.exceptions import ValidationError as SchemaValidationError

from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from django.template.defaultfilters import slugify
from sentry.api.validators.sentry_apps.schema import validate as validate_schema
from sentry.models import ApiScopes, SentryApp
from sentry.models.sentryapp import VALID_EVENT_RESOURCES, REQUIRED_EVENT_PERMISSIONS


class NameField(serializers.CharField):
    def from_native(self, data):
        rv = super(NameField, self).from_native(data)
        if not rv:
            return
        if not self.is_valid_slug(rv):
            raise ValidationError(u'Name {} is already taken, please use another.'.format(data))
        return rv

    def is_valid_slug(self, value):
        slug = slugify(value)

        if SentryApp.with_deleted.filter(slug=slug).exists():
            return False

        return True


class ApiScopesField(serializers.WritableField):
    def validate(self, data):
        valid_scopes = ApiScopes()
        if data is None:
            raise ValidationError('Must provide scopes')

        for scope in data:
            if scope not in valid_scopes:
                raise ValidationError(u'{} not a valid scope'.format(scope))


class EventListField(serializers.WritableField):
    def validate(self, data):
        if not set(data).issubset(VALID_EVENT_RESOURCES):
            raise ValidationError(u'Invalid event subscription: {}'.format(
                ', '.join(set(data).difference(VALID_EVENT_RESOURCES))
            ))


class SchemaField(serializers.WritableField):
    def validate(self, data):
        if data == {}:
            return

        try:
            validate_schema(data)
        except SchemaValidationError as e:
            raise ValidationError(e.message)


class SentryAppSerializer(Serializer):
    name = NameField()
    scopes = ApiScopesField()
    events = EventListField(required=False)
    schema = SchemaField(required=False)
    webhookUrl = serializers.URLField()
    redirectUrl = serializers.URLField(required=False)
    isAlertable = serializers.BooleanField(required=False)
    overview = serializers.CharField(required=False)

    def validate_events(self, attrs, source):
        if not attrs.get('scopes'):
            return attrs

        for resource in attrs.get(source):
            needed_scope = REQUIRED_EVENT_PERMISSIONS[resource]
            if needed_scope not in attrs['scopes']:
                raise ValidationError(
                    u'{} webhooks require the {} permission.'.format(resource, needed_scope),
                )

        return attrs

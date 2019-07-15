from __future__ import absolute_import

from jsonschema.exceptions import ValidationError as SchemaValidationError

from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from django.template.defaultfilters import slugify
from sentry.api.validators.sentry_apps.schema import validate as validate_schema
from sentry.models import ApiScopes, SentryApp
from sentry.models.sentryapp import VALID_EVENT_RESOURCES, REQUIRED_EVENT_PERMISSIONS


class SentryAppInstallationSerializer(Serializer):
    status = serializers.CharField()

    def validate_status(self, new_status):
        last_status = self.instance.status
        print ("last status", last_status)
        print ("new status", new_status)
        if last_status == 'installed':
            if not new_status in ['installed']:
                raise ValidationError('Cannot change installed integration to %s' % new_status)
        elif last_status == 'pending':
            if not new_status in ['pending', 'installed']:
                raise ValidationError('Cannot change pending integration to %s' % new_status)

        return new_status

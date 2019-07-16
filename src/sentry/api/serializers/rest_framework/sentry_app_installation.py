from __future__ import absolute_import


from collections import OrderedDict
from jsonschema.exceptions import ValidationError as SchemaValidationError

from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from django.template.defaultfilters import slugify
from sentry.api.validators.sentry_apps.schema import validate as validate_schema
from sentry.models import ApiScopes, SentryApp
from sentry.models.sentryapp import VALID_EVENT_RESOURCES, REQUIRED_EVENT_PERMISSIONS
from sentry.constants import SentryAppInstallationStatus


class SentryAppInstallationSerializer(Serializer):
    status = serializers.CharField()

    def validate_status(self, new_status):
        # make sure the status in in our defined list
        try:
            SentryAppInstallationStatus.STATUS_MAP[new_status]
        except KeyError as e:
            raise ValidationError(
                'Invalid value for status. Valid values: {}'.format(
                    SentryAppInstallationStatus.STATUS_MAP.keys(),
                ),
            )
        last_status = self.instance.status
        # make sure we don't go from installed to pending
        if last_status == SentryAppInstallationStatus.INSTALLED_STR and new_status == SentryAppInstallationStatus.PENDING_STR:
            raise ValidationError('Cannot change installed integration to pending')

        return new_status

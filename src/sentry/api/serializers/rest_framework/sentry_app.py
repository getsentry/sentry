from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.serializers import Serializer, ValidationError

from sentry.models import ApiScopes
from sentry.models.sentryapp import VALID_EVENTS


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
        if not set(data).issubset(VALID_EVENTS):
            raise ValidationError(u'Invalid event subscription: {}'.format(
                ', '.join(set(data).difference(VALID_EVENTS))
            ))


class SentryAppSerializer(Serializer):
    name = serializers.CharField()
    scopes = ApiScopesField()
    events = EventListField()
    webhookUrl = serializers.URLField()
    redirectUrl = serializers.URLField(required=False)
    isAlertable = serializers.BooleanField(required=False)
    overview = serializers.CharField(required=False)

    def validate_events(self, attrs, source):
        resources = [s.split(':')[0] for s in attrs['scopes']]
        for event in attrs[source]:
            if event == 'issue':
                resource = 'event'
            else:
                resource = event

            if resource not in resources:
                raise ValidationError(
                    u"resource type '{}' does not have the correct permissions.".format(event),
                )

        return attrs

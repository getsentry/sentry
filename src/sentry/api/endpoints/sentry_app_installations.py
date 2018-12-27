from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases import SentryAppInstallationsBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import SENTRY_APP_SLUG_MAX_LENGTH
from sentry.features.helpers import requires_feature
from sentry.mediators.sentry_app_installations import Creator
from sentry.models import SentryAppInstallation


class SentryAppInstallationsSerializer(serializers.Serializer):
    slug = serializers.RegexField(
        r'^[a-z0-9_\-]+$',
        max_length=SENTRY_APP_SLUG_MAX_LENGTH,
        error_messages={
            'invalid': _('Enter a valid slug consisting of lowercase letters, '
                         'numbers, underscores or hyphens.'),
        },
    )

    def validate(self, attrs):
        if not attrs.get('slug'):
            raise serializers.ValidationError('Sentry App slug is required')
        return attrs


class SentryAppInstallationsEndpoint(SentryAppInstallationsBaseEndpoint):
    @requires_feature('organizations:internal-catchall')
    def get(self, request, organization):
        queryset = SentryAppInstallation.objects.filter(
            organization=organization,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    @requires_feature('organizations:internal-catchall')
    def post(self, request, organization):
        serializer = SentryAppInstallationsSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        install = Creator.run(
            organization=organization,
            slug=serializer.object.get('slug'),
            user=request.user,
        )

        return Response(serialize(install))

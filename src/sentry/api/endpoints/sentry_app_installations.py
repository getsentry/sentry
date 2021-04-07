from django.utils.translation import ugettext_lazy as _
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases import SentryAppInstallationsBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import SENTRY_APP_SLUG_MAX_LENGTH
from sentry.mediators.sentry_app_installations import Creator
from sentry.models import SentryAppInstallation


class SentryAppInstallationsSerializer(serializers.Serializer):
    slug = serializers.RegexField(
        r"^[a-z0-9_\-]+$",
        max_length=SENTRY_APP_SLUG_MAX_LENGTH,
        error_messages={
            "invalid": _(
                "Enter a valid slug consisting of lowercase letters, "
                "numbers, underscores or hyphens."
            )
        },
    )

    def validate(self, attrs):
        if not attrs.get("slug"):
            raise serializers.ValidationError("Sentry App slug is required")
        return attrs


class SentryAppInstallationsEndpoint(SentryAppInstallationsBaseEndpoint):
    def get(self, request, organization):
        queryset = SentryAppInstallation.objects.filter(organization=organization)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request, organization):
        serializer = SentryAppInstallationsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # check for an exiting installation and return that if it exists
        slug = serializer.validated_data.get("slug")
        try:
            install = SentryAppInstallation.objects.get(
                sentry_app__slug=slug, organization=organization
            )
        except SentryAppInstallation.DoesNotExist:
            install = Creator.run(
                organization=organization, slug=slug, user=request.user, request=request
            )

        return Response(serialize(install))

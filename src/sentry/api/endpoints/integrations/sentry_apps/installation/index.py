from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases import SentryAppInstallationsBaseEndpoint
from sentry.api.fields.sentry_slug import SentrySlugField
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import SENTRY_APP_SLUG_MAX_LENGTH
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.installations import SentryAppInstallationCreator


class SentryAppInstallationsSerializer(serializers.Serializer):
    slug = SentrySlugField(required=True, max_length=SENTRY_APP_SLUG_MAX_LENGTH)


@control_silo_endpoint
class SentryAppInstallationsEndpoint(SentryAppInstallationsBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        queryset = SentryAppInstallation.objects.filter(organization_id=organization.id)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request: Request, organization) -> Response:
        serializer = SentryAppInstallationsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        # check for an exiting installation and return that if it exists
        slug = serializer.validated_data.get("slug")
        try:
            install = SentryAppInstallation.objects.get(
                sentry_app__slug=slug, organization_id=organization.id
            )
        except SentryAppInstallation.DoesNotExist:
            install = SentryAppInstallationCreator(
                organization_id=organization.id, slug=slug, notify=True
            ).run(user=request.user, request=request)

        return Response(serialize(install))

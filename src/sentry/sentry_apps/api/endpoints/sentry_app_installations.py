from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.fields.sentry_slug import SentrySerializerSlugField
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.superuser import superuser_has_permission
from sentry.constants import SENTRY_APP_SLUG_MAX_LENGTH, SentryAppStatus
from sentry.features.exceptions import FeatureNotRegistered
from sentry.integrations.models.integration_feature import IntegrationFeature, IntegrationTypes
from sentry.models.organization import Organization
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationsBaseEndpoint
from sentry.sentry_apps.api.serializers.sentry_app_installation import (
    SentryAppInstallationResult,
    SentryAppInstallationSerializer,
)
from sentry.sentry_apps.installations import SentryAppInstallationCreator
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class SentryAppInstallationsSerializer(serializers.Serializer):
    slug = SentrySerializerSlugField(required=True, max_length=SENTRY_APP_SLUG_MAX_LENGTH)


SENTRY_APP_INSTALLATIONS_EXAMPLE = OpenApiExample(
    "List Sentry App Installations",
    value=[
        {
            "app": {
                "uuid": "a9988ad6-5b3f-4905-bb93-f7cbf4c96bbb",
                "slug": "example-app",
                "sentryAppId": 1,
            },
            "organization": {"slug": "example-org", "id": 1},
            "uuid": "01635075-4f13-4f96-8fc8-ff9680780a13",
            "status": "installed",
        }
    ],
    response_only=True,
    status_codes=["200"],
)


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class SentryAppInstallationsEndpoint(SentryAppInstallationsBaseEndpoint):
    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List an Organization's Sentry App Installations",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, CursorQueryParam],
        responses={
            200: inline_sentry_response_serializer(
                "ListSentryAppInstallations", list[SentryAppInstallationResult]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[SENTRY_APP_INSTALLATIONS_EXAMPLE],
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[SentryAppInstallationResult]]:
        """
        Return a list of an organization's installations of custom integrations (Sentry Apps).
        """
        queryset = SentryAppInstallation.objects.filter(organization_id=organization.id)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, access=request.access, serializer=SentryAppInstallationSerializer()
            ),
        )

    def post(self, request: Request, organization) -> Response:
        serializer = SentryAppInstallationsSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        slug = serializer.validated_data.get("slug")

        # only published or owned apps are allowed to be installed
        app = SentryApp.objects.filter(slug=slug).first()
        if app is None or (
            app.status != SentryAppStatus.PUBLISHED
            and app.owner_id != organization.id
            and not superuser_has_permission(request)
        ):
            return Response(status=404)

        # feature check
        app_features = IntegrationFeature.objects.filter(
            target_id=app.id, target_type=IntegrationTypes.SENTRY_APP.value
        )

        is_feature_enabled = {}
        for feature in app_features:
            feature_flag_name = "organizations:%s" % feature.feature_str()
            try:
                features.get(feature_flag_name, None)
                is_feature_enabled[feature_flag_name] = features.has(
                    feature_flag_name, organization
                )
            except FeatureNotRegistered:
                is_feature_enabled[feature_flag_name] = True

        if not any(is_feature_enabled.values()):
            return Response(
                {
                    "detail": "At least one feature from this list has to be enabled in order to install the app",
                    "missing_features": list(is_feature_enabled.keys()),
                },
                status=403,
            )

        try:
            # check for an exiting installation and return that if it exists
            install = SentryAppInstallation.objects.get(
                sentry_app__slug=slug, organization_id=organization.id
            )
        except SentryAppInstallation.DoesNotExist:
            assert isinstance(request.user, (User, RpcUser)), (
                "user must be authenticated to create a SentryAppInstallation"
            )
            install = SentryAppInstallationCreator(
                organization_id=organization.id, slug=slug, notify=True
            ).run(user=request.user, request=request)

        return Response(
            serialize(install, access=request.access, serializer=SentryAppInstallationSerializer())
        )

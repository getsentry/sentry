import logging

import orjson
import sentry_sdk
from django.db import router, transaction
from drf_spectacular.utils import extend_schema
from requests import RequestException
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, deletions, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NO_CONTENT
from sentry.apidocs.examples.sentry_app_examples import SentryAppExamples
from sentry.apidocs.parameters import SentryAppParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.staff import is_active_staff
from sentry.constants import SentryAppStatus
from sentry.organizations.services.organization import organization_service
from sentry.sentry_apps.api.bases.sentryapps import (
    SentryAppAndStaffPermission,
    SentryAppBaseEndpoint,
    catch_raised_errors,
)
from sentry.sentry_apps.api.parsers.sentry_app import SentryAppParser
from sentry.sentry_apps.api.serializers.sentry_app import (
    SentryAppSerializer as ResponseSentryAppSerializer,
)
from sentry.sentry_apps.api.serializers.sentry_app import SentryAppSerializerResponse
from sentry.sentry_apps.installations import SentryAppInstallationNotifier
from sentry.sentry_apps.logic import SentryAppUpdater
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils.audit import create_audit_entry

logger = logging.getLogger(__name__)
PARTNERSHIP_RESTRICTED_ERROR_MESSAGE = "This integration is managed by an active partnership and cannot be modified until the end of the partnership."


class SentryAppDetailsEndpointPermission(SentryAppAndStaffPermission):
    """Allows staff to access the GET and PUT methods which are used in _admin."""

    staff_allowed_methods = {"GET", "PUT"}


@extend_schema(tags=["Integration"])
@control_silo_endpoint
class SentryAppDetailsEndpoint(SentryAppBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (SentryAppDetailsEndpointPermission,)

    @extend_schema(
        operation_id="Retrieve a custom integration by ID or slug.",
        parameters=[
            SentryAppParams.SENTRY_APP_ID_OR_SLUG,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "SentryAppDetailsResponse", SentryAppSerializerResponse
            ),
        },
        examples=SentryAppExamples.RETRIEVE_SENTRY_APP,
    )
    def get(self, request: Request, sentry_app) -> Response:
        """
        Retrieve a custom integration.
        """
        return Response(
            serialize(
                sentry_app,
                request.user,
                access=request.access,
                serializer=ResponseSentryAppSerializer(),
            )
        )

    @extend_schema(
        operation_id="Update an existing custom integration.",
        parameters=[
            SentryAppParams.SENTRY_APP_ID_OR_SLUG,
        ],
        request=SentryAppParser,
        responses={
            200: inline_sentry_response_serializer(
                "SentryAppDetailsResponse", SentryAppSerializerResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
        examples=SentryAppExamples.UPDATE_SENTRY_APP,
    )
    @catch_raised_errors
    def put(self, request: Request, sentry_app) -> Response:
        """
        Update an existing custom integration.
        """
        if sentry_app.metadata.get("partnership_restricted", False):
            return Response(
                {"detail": PARTNERSHIP_RESTRICTED_ERROR_MESSAGE},
                status=403,
            )
        owner_context = organization_service.get_organization_by_id(
            id=sentry_app.owner_id, user_id=None, include_projects=False, include_teams=False
        )
        if (
            owner_context
            and self._has_hook_events(request)
            and not features.has(
                "organizations:integrations-event-hooks",
                owner_context.organization,
                actor=request.user,
            )
        ):
            return Response(
                {
                    "non_field_errors": [
                        "Your organization does not have access to the 'error' resource subscription."
                    ]
                },
                status=403,
            )

        # isInternal is not field of our model but it is a field of the serializer
        data = request.data.copy()
        data["isInternal"] = sentry_app.status == SentryAppStatus.INTERNAL
        serializer = SentryAppParser(
            sentry_app,
            data=data,
            partial=True,
            access=request.access,
            active_staff=is_active_staff(request),
        )

        if serializer.is_valid():
            result = serializer.validated_data

            assert isinstance(
                request.user, (User, RpcUser)
            ), "User must be authenticated to update a Sentry App"
            updated_app = SentryAppUpdater(
                sentry_app=sentry_app,
                name=result.get("name"),
                author=result.get("author"),
                features=result.get("features"),
                status=result.get("status"),
                webhook_url=result.get("webhookUrl"),
                redirect_url=result.get("redirectUrl"),
                is_alertable=result.get("isAlertable"),
                verify_install=result.get("verifyInstall"),
                scopes=result.get("scopes"),
                events=result.get("events"),
                schema=result.get("schema"),
                overview=result.get("overview"),
                allowed_origins=result.get("allowedOrigins"),
                popularity=result.get("popularity"),
            ).run(user=request.user)

            return Response(
                serialize(
                    updated_app,
                    request.user,
                    access=request.access,
                    serializer=ResponseSentryAppSerializer(),
                )
            )

        # log any errors with schema
        if "schema" in serializer.errors:
            for error_message in serializer.errors["schema"]:
                name = "sentry_app.schema_validation_error"
                log_info = {
                    "schema": orjson.dumps(request.data["schema"]).decode(),
                    "user_id": request.user.id,
                    "sentry_app_id": sentry_app.id,
                    "sentry_app_name": sentry_app.name,
                    "organization_id": sentry_app.owner_id,
                    "error_message": error_message,
                }
                logger.info(name, extra=log_info)
                analytics.record(name, **log_info)

        return Response(serializer.errors, status=400)

    @extend_schema(
        operation_id="Delete a custom integration.",
        parameters=[
            SentryAppParams.SENTRY_APP_ID_OR_SLUG,
        ],
        responses={204: RESPONSE_NO_CONTENT, 403: RESPONSE_FORBIDDEN},
    )
    def delete(self, request: Request, sentry_app) -> Response:
        """
        Delete a custom integration.
        """
        if sentry_app.metadata.get("partnership_restricted", False):
            return Response(
                {"detail": PARTNERSHIP_RESTRICTED_ERROR_MESSAGE},
                status=403,
            )
        if sentry_app.is_unpublished or sentry_app.is_internal:
            if not sentry_app.is_internal:
                for install in sentry_app.installations.all():
                    try:
                        with transaction.atomic(using=router.db_for_write(SentryAppInstallation)):
                            assert (
                                request.user.is_authenticated
                            ), "User must be authenticated to delete installation"
                            SentryAppInstallationNotifier(
                                sentry_app_installation=install, user=request.user, action="deleted"
                            ).run()
                            deletions.exec_sync(install)
                    except RequestException as exc:
                        sentry_sdk.capture_exception(exc)

            with transaction.atomic(using=router.db_for_write(SentryApp)):
                deletions.exec_sync(sentry_app)
                create_audit_entry(
                    request=request,
                    organization_id=sentry_app.owner_id,
                    target_object=sentry_app.owner_id,
                    event=audit_log.get_event_id("SENTRY_APP_REMOVE"),
                    data={"sentry_app": sentry_app.name},
                )
            analytics.record(
                "sentry_app.deleted",
                user_id=request.user.id,
                organization_id=sentry_app.owner_id,
                sentry_app=sentry_app.slug,
            )
            return Response(status=204)

        return Response({"detail": ["Published apps cannot be removed."]}, status=403)

    def _has_hook_events(self, request: Request):
        if not request.data.get("events"):
            return False

        return "error" in request.data["events"]

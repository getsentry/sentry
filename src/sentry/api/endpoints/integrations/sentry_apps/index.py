import logging

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ValidationError

from sentry import analytics, features
from sentry.api.base import control_silo_endpoint
from sentry.api.bases import SentryAppsBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.constants import SentryAppStatus
from sentry.models import SentryApp
from sentry.sentry_apps.apps import SentryAppCreator
from sentry.utils import json

logger = logging.getLogger(__name__)


@control_silo_endpoint
class SentryAppsEndpoint(SentryAppsBaseEndpoint):
    def get(self, request: Request) -> Response:
        status = request.GET.get("status")

        if status == "published":
            queryset = SentryApp.objects.filter(status=SentryAppStatus.PUBLISHED)

        elif status == "unpublished":
            queryset = SentryApp.objects.filter(status=SentryAppStatus.UNPUBLISHED)
            if not is_active_superuser(request):
                queryset = queryset.filter(owner_id__in=[o.id for o in request.user.get_orgs()])
        elif status == "internal":
            queryset = SentryApp.objects.filter(status=SentryAppStatus.INTERNAL)
            if not is_active_superuser(request):
                queryset = queryset.filter(owner_id__in=[o.id for o in request.user.get_orgs()])
        else:
            if is_active_superuser(request):
                queryset = SentryApp.objects.all()
            else:
                queryset = SentryApp.objects.filter(status=SentryAppStatus.PUBLISHED)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, access=request.access),
        )

    def post(self, request: Request, organization) -> Response:
        data = {
            "name": request.json_body.get("name"),
            "user": request.user,
            "author": request.json_body.get("author"),
            "organization": organization,
            "webhookUrl": request.json_body.get("webhookUrl"),
            "redirectUrl": request.json_body.get("redirectUrl"),
            "isAlertable": request.json_body.get("isAlertable"),
            "isInternal": request.json_body.get("isInternal"),
            "verifyInstall": request.json_body.get("verifyInstall"),
            "scopes": request.json_body.get("scopes", []),
            "events": request.json_body.get("events", []),
            "schema": request.json_body.get("schema", {}),
            "overview": request.json_body.get("overview"),
            "allowedOrigins": request.json_body.get("allowedOrigins", []),
            "popularity": request.json_body.get("popularity")
            if is_active_superuser(request)
            else None,
        }

        if self._has_hook_events(request) and not features.has(
            "organizations:integrations-event-hooks", organization, actor=request.user
        ):

            return Response(
                {
                    "non_field_errors": [
                        "Your organization does not have access to the 'error' resource subscription."
                    ]
                },
                status=403,
            )

        serializer = SentryAppSerializer(data=data, access=request.access)

        if serializer.is_valid():
            if data.get("isInternal"):
                data["verifyInstall"] = False
                data["author"] = data["author"] or organization.name

            try:
                sentry_app = SentryAppCreator(
                    name=data["name"],
                    author=data["author"],
                    organization_id=organization.id,
                    is_internal=data["isInternal"],
                    scopes=data["scopes"],
                    events=data["events"],
                    webhook_url=data["webhookUrl"],
                    redirect_url=data["redirectUrl"],
                    is_alertable=data["isAlertable"],
                    verify_install=data["verifyInstall"],
                    schema=data["schema"],
                    overview=data["overview"],
                    allowed_origins=data["allowedOrigins"],
                    popularity=data["popularity"],
                ).run(user=request.user, request=request)
            except ValidationError as e:
                # we generate and validate the slug here instead of the serializer since the slug never changes
                return Response(e.detail, status=400)

            return Response(serialize(sentry_app, access=request.access), status=201)

        # log any errors with schema
        if "schema" in serializer.errors:
            for error_message in serializer.errors["schema"]:
                name = "sentry_app.schema_validation_error"
                log_info = {
                    "schema": json.dumps(data["schema"]),
                    "user_id": request.user.id,
                    "sentry_app_name": data["name"],
                    "organization_id": organization.id,
                    "error_message": error_message,
                }
                logger.info(name, extra=log_info)
                analytics.record(name, **log_info)
        return Response(serializer.errors, status=400)

    def _has_hook_events(self, request: Request):
        if not request.json_body.get("events"):
            return False

        return "error" in request.json_body["events"]

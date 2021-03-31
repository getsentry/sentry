import logging

from rest_framework.response import Response
from rest_framework.serializers import ValidationError

from sentry import analytics, features
from sentry.api.bases import SentryAppsBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import SentryAppSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.constants import SentryAppStatus
from sentry.mediators.sentry_apps import Creator, InternalCreator
from sentry.models import SentryApp
from sentry.utils import json

logger = logging.getLogger(__name__)


class SentryAppsEndpoint(SentryAppsBaseEndpoint):
    def get(self, request):
        status = request.GET.get("status")

        if status == "published":
            queryset = SentryApp.objects.filter(status=SentryAppStatus.PUBLISHED)

        elif status == "unpublished":
            queryset = SentryApp.objects.filter(status=SentryAppStatus.UNPUBLISHED)
            if not is_active_superuser(request):
                queryset = queryset.filter(owner__in=request.user.get_orgs())
        elif status == "internal":
            queryset = SentryApp.objects.filter(status=SentryAppStatus.INTERNAL)
            if not is_active_superuser(request):
                queryset = queryset.filter(owner__in=request.user.get_orgs())
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

    def post(self, request, organization):
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
            data["redirect_url"] = data["redirectUrl"]
            data["webhook_url"] = data["webhookUrl"]
            data["is_alertable"] = data["isAlertable"]
            data["verify_install"] = data["verifyInstall"]
            data["allowed_origins"] = data["allowedOrigins"]
            data["is_internal"] = data.get("isInternal")

            creator = InternalCreator if data.get("isInternal") else Creator
            try:
                sentry_app = creator.run(request=request, **data)
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

    def _has_hook_events(self, request):
        if not request.json_body.get("events"):
            return False

        return "error" in request.json_body["events"]

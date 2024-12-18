import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ValidationError

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.constants import SentryAppStatus
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.organizations.services.organization import organization_service
from sentry.sentry_apps.api.bases.sentryapps import SentryAppsBaseEndpoint
from sentry.sentry_apps.api.parsers.sentry_app import SentryAppParser
from sentry.sentry_apps.api.serializers.sentry_app import (
    SentryAppSerializer as ResponseSentryAppSerializer,
)
from sentry.sentry_apps.logic import SentryAppCreator
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

logger = logging.getLogger(__name__)


@control_silo_endpoint
class SentryAppsEndpoint(SentryAppsBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    def get(self, request: Request) -> Response:
        status = request.GET.get("status")
        elevated_user = is_active_superuser(request) or is_active_staff(request)

        if status == "published":
            queryset = SentryApp.objects.filter(status=SentryAppStatus.PUBLISHED)

        elif status == "unpublished":
            queryset = SentryApp.objects.filter(status=SentryAppStatus.UNPUBLISHED)
            if not elevated_user:
                queryset = self._filter_queryset_for_user(queryset, request.user.id)
        elif status == "internal":
            queryset = SentryApp.objects.filter(status=SentryAppStatus.INTERNAL)
            if not elevated_user:
                queryset = self._filter_queryset_for_user(queryset, request.user.id)
        else:
            if elevated_user:
                queryset = SentryApp.objects.all()
            else:
                queryset = SentryApp.objects.filter(status=SentryAppStatus.PUBLISHED)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, access=request.access, serializer=ResponseSentryAppSerializer()
            ),
        )

    def post(self, request: Request, organization) -> Response:
        data = {
            "name": request.data.get("name"),
            "user": request.user,
            "author": request.data.get("author"),
            "organization": organization,
            "webhookUrl": request.data.get("webhookUrl"),
            "redirectUrl": request.data.get("redirectUrl"),
            "isAlertable": request.data.get("isAlertable"),
            "isInternal": request.data.get("isInternal"),
            "verifyInstall": request.data.get("verifyInstall"),
            "scopes": request.data.get("scopes", []),
            "events": request.data.get("events", []),
            "schema": request.data.get("schema", {}),
            "overview": request.data.get("overview"),
            "allowedOrigins": request.data.get("allowedOrigins", []),
            "popularity": (
                request.data.get("popularity") if is_active_superuser(request) else None
            ),
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

        serializer = SentryAppParser(data=data, access=request.access)

        if serializer.is_valid():
            if data.get("isInternal"):
                data["verifyInstall"] = False
                data["author"] = data["author"] or organization.name

            try:
                assert isinstance(
                    request.user, (User, RpcUser)
                ), "User must be authenticated to create a Sentry App"
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
                ).run(user=request.user, request=request, skip_default_auth_token=True)
                # We want to stop creating the default auth token for new apps and installations through the API
            except ValidationError as e:
                # we generate and validate the slug here instead of the serializer since the slug never changes
                return Response(e.detail, status=400)

            return Response(
                serialize(
                    sentry_app, access=request.access, serializer=ResponseSentryAppSerializer()
                ),
                status=201,
            )

        # log any errors with schema
        if "schema" in serializer.errors:
            for error_message in serializer.errors["schema"]:
                name = "sentry_app.schema_validation_error"
                log_info = {
                    "schema": orjson.dumps(data["schema"]).decode(),
                    "user_id": request.user.id,
                    "sentry_app_name": data["name"],
                    "organization_id": organization.id,
                    "error_message": error_message,
                }
                logger.info(name, extra=log_info)
                analytics.record(name, **log_info)
        return Response(serializer.errors, status=400)

    def _filter_queryset_for_user(self, queryset: BaseQuerySet[SentryApp, SentryApp], user_id: int):
        owner_ids = []
        for o in user_service.get_organizations(user_id=user_id, only_visible=True):
            org_context = organization_service.get_organization_by_id(id=o.id, user_id=user_id)
            if org_context and org_context.member and "org:read" in org_context.member.scopes:
                owner_ids.append(o.id)

        return queryset.filter(owner_id__in=owner_ids)

    def _has_hook_events(self, request: Request):
        if not request.data.get("events"):
            return False

        return "error" in request.data["events"]

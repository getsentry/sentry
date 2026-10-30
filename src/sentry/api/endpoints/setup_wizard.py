from __future__ import annotations

import logging
from typing import Literal, NotRequired, TypedDict

from django.conf import settings
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils.crypto import get_random_string
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import SAFE_METHODS
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import ratelimits
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.permissions import DisallowImpersonatedTokenCreation, SentryPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.cache import default_cache
from sentry.demo_mode.utils import is_demo_user
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.projects.services.project.model import RpcProject
from sentry.projects.services.project.service import project_service
from sentry.utils import auth
from sentry.utils.http import absolute_uri
from sentry.utils.setup_wizard import get_cache_data
from sentry.utils.urls import add_params_to_url

logger = logging.getLogger("sentry.api")
SETUP_WIZARD_CACHE_KEY = "setup-wizard-keys:v1:"
SETUP_WIZARD_CACHE_TIMEOUT = 600
SETUP_WIZARD_COMPLETED_CACHE_KEY = "setup-wizard-completed:v1:"


@control_silo_endpoint
class SetupWizard(Endpoint):
    owner = ApiOwner.WEB_FRONTEND_SDKS
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = ()

    def delete(self, request: Request, wizard_hash=None) -> Response | None:
        """
        This removes the cache content for a specific hash
        """
        if wizard_hash is not None:
            key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
            data = default_cache.get(key)
            if data is not None and data != "empty":
                default_cache.set(
                    f"{SETUP_WIZARD_COMPLETED_CACHE_KEY}{wizard_hash}",
                    True,
                    SETUP_WIZARD_CACHE_TIMEOUT,
                )
            default_cache.delete(key)
            return Response(status=200)
        return None

    def get(self, request: Request, wizard_hash=None) -> Response:
        """
        This tries to retrieve and return the cache content if possible
        otherwise creates new cache
        """
        if is_demo_user(request.user):
            return Response(status=403)

        if wizard_hash is not None:
            key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
            wizard_data = default_cache.get(key)

            if wizard_data is None:
                return Response(status=404)
            elif wizard_data == "empty":
                # when we just created a clean cache
                return Response(status=400)

            return Response(serialize(wizard_data))
        else:
            # This creates a new available hash url for the project wizard
            rate_limited = ratelimits.backend.is_limited(
                key="rl:setup-wizard:ip:%s" % request.META["REMOTE_ADDR"], limit=10
            )
            if rate_limited:
                logger.info("setup-wizard.rate-limit")
                return Response({"Too many wizard requests"}, status=403)
            wizard_hash = get_random_string(64, allowed_chars="abcdefghijklmnopqrstuvwxyz012345679")

            key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
            default_cache.set(key, "empty", SETUP_WIZARD_CACHE_TIMEOUT)
            return Response(serialize({"hash": wizard_hash}))


class WizardSessionResponse(TypedDict):
    status: Literal["pending", "selected", "completed", "expired", "unauthenticated"]
    redirectUrl: NotRequired[str]


class WizardSessionInitializeRequest(TypedDict):
    organization_slug: str | None
    project_slug: str | None


class WizardSessionInitializeSerializer(CamelSnakeSerializer[WizardSessionInitializeRequest]):
    organization_slug = serializers.CharField(required=False, default=None, allow_null=True)
    project_slug = serializers.CharField(required=False, default=None, allow_null=True)


class WizardSessionSelectRequest(TypedDict):
    organization_id: int
    project_id: int


class WizardSessionSelectSerializer(CamelSnakeSerializer[WizardSessionSelectRequest]):
    organization_id = serializers.IntegerField(min_value=1)
    project_id = serializers.IntegerField(min_value=1)


class WizardSessionPermission(SentryPermission):
    def has_permission(self, request: Request, view: object) -> bool:
        return request.method in SAFE_METHODS or request.user.is_authenticated


@extend_schema(tags=["Projects"])
@control_silo_endpoint
class SetupWizardSession(Endpoint):
    owner = ApiOwner.WEB_FRONTEND_SDKS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (WizardSessionPermission, DisallowImpersonatedTokenCreation)
    csrf_protect = True

    @extend_schema(operation_id="Retrieve a Wizard Session", responses={200: WizardSessionResponse})
    def get(self, request: Request, wizard_hash: str) -> Response:
        if is_demo_user(request.user):
            return Response(status=403)

        if not request.user.is_authenticated:
            params = request.GET.dict()
            signup = params.pop("signup", None) == "1"
            wizard_url = add_params_to_url(
                absolute_uri(reverse("sentry-project-wizard-fetch", args=[wizard_hash])), params
            )
            destination = (
                settings.SENTRY_SIGNUP_URL
                if signup and settings.SENTRY_SIGNUP_URL
                else auth.get_login_url()
            )
            return Response(
                {
                    "status": "unauthenticated",
                    "redirectUrl": add_params_to_url(destination, {**params, "next": wizard_url}),
                }
            )

        return Response(self.get_state(wizard_hash))

    @extend_schema(
        operation_id="Initialize a Wizard Session",
        request=WizardSessionInitializeSerializer,
        responses={200: WizardSessionResponse},
    )
    def post(self, request: Request, wizard_hash: str) -> Response:
        if is_demo_user(request.user):
            return Response(status=403)

        assert request.user.id is not None
        state = self.get_state(wizard_hash)
        if state["status"] != "pending":
            return Response(state)

        serializer = WizardSessionInitializeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if not data["organization_slug"] or not data["project_slug"]:
            return Response(state)

        mapping = OrganizationMapping.objects.filter(
            slug=data["organization_slug"],
            organization_id__in=OrganizationMemberMapping.objects.filter(
                user_id=request.user.id
            ).values_list("organization_id", flat=True),
            status=OrganizationStatus.ACTIVE,
        ).first()
        if mapping is None:
            return Response(state)

        project = project_service.get_by_slug(
            slug=data["project_slug"], organization_id=mapping.organization_id
        )
        if project is None:
            return Response(state)

        return self.select_project(request, wizard_hash, mapping, project)

    @extend_schema(
        operation_id="Select a Wizard Project",
        request=WizardSessionSelectSerializer,
        responses={200: WizardSessionResponse},
    )
    def put(self, request: Request, wizard_hash: str) -> Response:
        if is_demo_user(request.user):
            return Response(status=403)

        assert request.user.id is not None
        state = self.get_state(wizard_hash)
        if state["status"] in ("expired", "completed"):
            return Response({"detail": "Wizard session has expired"}, status=404)

        serializer = WizardSessionSelectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        mapping = get_object_or_404(
            OrganizationMapping,
            organization_id=data["organization_id"],
            organization_id__in=OrganizationMemberMapping.objects.filter(
                user_id=request.user.id
            ).values_list("organization_id", flat=True),
            status=OrganizationStatus.ACTIVE,
        )
        project = project_service.get_by_id(
            organization_id=mapping.organization_id, id=data["project_id"]
        )
        if project is None:
            return Response({"detail": "Project not found"}, status=404)

        return self.select_project(request, wizard_hash, mapping, project)

    def get_state(self, wizard_hash: str) -> WizardSessionResponse:
        data = default_cache.get(f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}")
        if data is None:
            if default_cache.get(f"{SETUP_WIZARD_COMPLETED_CACHE_KEY}{wizard_hash}"):
                return {"status": "completed"}
            return {"status": "expired"}
        if data == "empty":
            return {"status": "pending"}
        return {"status": "selected"}

    def select_project(
        self, request: Request, wizard_hash: str, mapping: OrganizationMapping, project: RpcProject
    ) -> Response:
        try:
            data = get_cache_data(mapping=mapping, project=project, user=request.user)
        except Http404:
            return Response({"detail": "No DSN found for this project"}, status=404)

        default_cache.set(
            f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}", data, SETUP_WIZARD_CACHE_TIMEOUT
        )
        return Response({"status": "selected"})

from urllib.parse import urlparse

from django.db import router, transaction
from rest_framework import serializers
from rest_framework.authentication import SessionAuthentication
from rest_framework.fields import empty
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ListField

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SentryIsAuthenticated
from sentry.api.serializers import serialize
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus


class CustomSchemeURLField(serializers.CharField):
    """URLField that only allows specific safe schemes for OAuth redirect URIs.

    Uses an allowlist approach for maximum security, only permitting:
    - http/https: Standard web protocols
    - sentry-mobile-agent: Sentry's custom mobile app scheme
    """

    # Only these schemes are allowed for OAuth redirect URIs
    ALLOWED_SCHEMES = {
        "http",  # Standard HTTP
        "https",  # Secure HTTP
        "sentry-mobile-agent",  # Sentry mobile app custom scheme
    }

    default_error_messages = {
        "invalid": "Enter a valid URL.",
        "disallowed_scheme": "This URL scheme is not allowed. Only http, https, and sentry-mobile-agent schemes are permitted.",
    }

    def run_validation(self, data: object | None = empty) -> object | None:
        # First run the standard CharField validations
        data = super().run_validation(data)

        if data is None:
            return data

        if data == "":
            self.fail("invalid")

        # After CharField validation and None/empty checks, data must be a string
        assert isinstance(data, str)

        # Basic URL structure validation
        try:
            parsed = urlparse(data)
            if not parsed.scheme:
                self.fail("invalid")

            # Check if the scheme is in the allowlist
            scheme_lower = parsed.scheme.lower()
            if scheme_lower not in self.ALLOWED_SCHEMES:
                self.fail("disallowed_scheme")

            # All URIs must use :// format (not just :/)
            # This ensures proper URI structure: scheme://netloc or scheme://path
            if "://" not in data:
                self.fail("invalid")

            # For http/https, netloc is required (must have a domain)
            if scheme_lower in {"http", "https"}:
                if not parsed.netloc:
                    self.fail("invalid")
            else:
                # Custom schemes must have netloc (the part after ://)
                # This ensures sentry-mobile-agent://callback is valid
                # but sentry-mobile-agent:// is not
                if not parsed.netloc:
                    self.fail("invalid")
        except Exception:
            self.fail("invalid")

        return data


class ApiApplicationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    redirectUris = ListField(child=CustomSchemeURLField(max_length=255), required=False)
    allowedOrigins = ListField(
        # TODO(dcramer): make this validate origins
        child=serializers.CharField(max_length=255),
        required=False,
    )
    homepageUrl = serializers.URLField(
        max_length=255, required=False, allow_null=True, allow_blank=True
    )
    termsUrl = serializers.URLField(
        max_length=255, required=False, allow_null=True, allow_blank=True
    )
    privacyUrl = serializers.URLField(
        max_length=255, required=False, allow_null=True, allow_blank=True
    )


class ApiApplicationEndpoint(Endpoint):
    def convert_args(
        self,
        request: Request,
        app_id: str,
        *args,
        **kwargs,
    ):
        try:
            application = ApiApplication.objects.get(
                owner_id=request.user.id, client_id=app_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            raise ResourceDoesNotExist
        kwargs["application"] = application
        return (args, kwargs)


@control_silo_endpoint
class ApiApplicationDetailsEndpoint(ApiApplicationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SessionAuthentication,)
    permission_classes = (SentryIsAuthenticated,)

    def get(self, request: Request, application: ApiApplication) -> Response:
        return Response(serialize(application, request.user))

    def put(self, request: Request, application: ApiApplication) -> Response:
        serializer = ApiApplicationSerializer(data=request.data, partial=True)

        if serializer.is_valid():
            result = serializer.validated_data
            kwargs = {}
            if "name" in result:
                kwargs["name"] = result["name"]
            if "allowedOrigins" in result:
                kwargs["allowed_origins"] = "\n".join(result["allowedOrigins"])
            if "redirectUris" in result:
                kwargs["redirect_uris"] = "\n".join(result["redirectUris"])
            if "homepageUrl" in result:
                kwargs["homepage_url"] = result["homepageUrl"]
            if "privacyUrl" in result:
                kwargs["privacy_url"] = result["privacyUrl"]
            if "termsUrl" in result:
                kwargs["terms_url"] = result["termsUrl"]
            if kwargs:
                application.update(**kwargs)
            return Response(serialize(application, request.user), status=200)
        return Response(serializer.errors, status=400)

    def delete(self, request: Request, application: ApiApplication) -> Response:
        with transaction.atomic(using=router.db_for_write(ApiApplication)):
            updated = ApiApplication.objects.filter(id=application.id).update(
                status=ApiApplicationStatus.pending_deletion
            )
            if updated:
                ScheduledDeletion.schedule(application, days=0, actor=request.user)
        return Response(status=204)

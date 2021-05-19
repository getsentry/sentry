import logging
from uuid import uuid4

from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ListField
from sentry.models import ApiApplication, ApiApplicationStatus
from sentry.tasks.deletion import delete_api_application

delete_logger = logging.getLogger("sentry.deletions.api")


class ApiApplicationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)
    redirectUris = ListField(child=serializers.URLField(max_length=255), required=False)
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


class ApiApplicationDetailsEndpoint(Endpoint):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsAuthenticated,)

    def get(self, request, app_id):
        try:
            instance = ApiApplication.objects.get(
                owner=request.user, client_id=app_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(instance, request.user))

    def put(self, request, app_id):
        try:
            instance = ApiApplication.objects.get(
                owner=request.user, client_id=app_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            raise ResourceDoesNotExist

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
                instance.update(**kwargs)
            return Response(serialize(instance, request.user), status=200)
        return Response(serializer.errors, status=400)

    def delete(self, request, app_id):
        try:
            instance = ApiApplication.objects.get(
                owner=request.user, client_id=app_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            raise ResourceDoesNotExist

        updated = ApiApplication.objects.filter(id=instance.id).update(
            status=ApiApplicationStatus.pending_deletion
        )
        if updated:
            transaction_id = uuid4().hex

            delete_api_application.apply_async(
                kwargs={"object_id": instance.id, "transaction_id": transaction_id}, countdown=3600
            )

            delete_logger.info(
                "object.delete.queued",
                extra={
                    "object_id": instance.id,
                    "transaction_id": transaction_id,
                    "model": type(instance).__name__,
                },
            )

        return Response(status=204)

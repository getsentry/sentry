import calendar
from typing import Any

from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.promptsactivity import PromptsActivity
from sentry.utils.prompts import prompt_config

VALID_STATUSES = frozenset(("snoozed", "dismissed", "visible"))


# Endpoint to retrieve multiple PromptsActivity at once
class PromptsActivitySerializer(serializers.Serializer):
    feature = serializers.CharField(required=True)
    status = serializers.ChoiceField(
        choices=list(zip(VALID_STATUSES, VALID_STATUSES)), required=True
    )

    def validate_feature(self, value):
        if value is None:
            raise serializers.ValidationError("Must specify feature name")
        if not prompt_config.has(value):
            raise serializers.ValidationError("Not a valid feature prompt")
        return value


@region_silo_endpoint
class PromptsActivityEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization: Organization, **kwargs) -> Response:
        """Return feature prompt status if dismissed or in snoozed period"""

        if not request.user.is_authenticated:
            return Response(status=400)

        features = request.GET.getlist("feature")
        if len(features) == 0:
            return Response({"details": "No feature specified"}, status=400)

        conditions: Q | None = None
        for feature in features:
            if not prompt_config.has(feature):
                return Response({"detail": "Invalid feature name " + feature}, status=400)

            required_fields = prompt_config.required_fields(feature)
            filters: dict[str, Any] = {}

            # project_id must be provided and belong to the organization
            if "project_id" in required_fields:
                project_id = request.GET.get("project_id")
                if not project_id:
                    return Response({"detail": 'Missing required field "project_id"'}, status=400)
                if not Project.objects.filter(
                    id=project_id, organization_id=organization.id
                ).exists():
                    return Response({"detail": "Project not found"}, status=404)
                filters["project_id"] = project_id

            condition = Q(feature=feature, **filters)
            conditions = condition if conditions is None else (conditions | condition)

        # Always scope by organization from URL - passed directly to filter() to prevent override
        result_qs = PromptsActivity.objects.filter(
            conditions, user_id=request.user.id, organization_id=organization.id
        )
        featuredata = {k.feature: k.data for k in result_qs}
        if len(features) == 1:
            result = result_qs.first()
            data = None if result is None else result.data
            return Response({"data": data, "features": featuredata})
        else:
            return Response({"features": featuredata})

    def put(self, request: Request, organization: Organization, **kwargs) -> Response:
        serializer = PromptsActivitySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.validated_data
        feature = serialized["feature"]
        status = serialized["status"]

        required_fields = prompt_config.required_fields(feature)
        fields = {k: request.data.get(k) for k in required_fields}

        if any(elem is None for elem in fields.values()):
            return Response({"detail": "Missing required field"}, status=400)

        # Validate organization_id is present and matches URL organization
        if "organization_id" not in required_fields or str(fields["organization_id"]) != str(
            organization.id
        ):
            return Response({"detail": "Organization missing or mismatched"}, status=400)
        # Override with URL organization to prevent IDOR
        fields["organization_id"] = organization.id

        # Validate project_id if required, otherwise use dummy value to prevent duplicates
        if "project_id" in required_fields:
            project_id = fields["project_id"]
            if not project_id:
                return Response({"detail": "Invalid project_id"}, status=400)
            if not Project.objects.filter(id=project_id, organization_id=organization.id).exists():
                return Response(
                    {"detail": "Project does not belong to this organization"}, status=400
                )
        else:
            fields["project_id"] = 0

        data: dict[str, Any] = {}
        now = calendar.timegm(timezone.now().utctimetuple())
        if status == "snoozed":
            data["snoozed_ts"] = now
        elif status == "dismissed":
            data["dismissed_ts"] = now
        elif status == "visible":
            data["snoozed_ts"] = None
            data["dismissed_ts"] = None

        try:
            with transaction.atomic(router.db_for_write(PromptsActivity)):
                PromptsActivity.objects.create_or_update(
                    feature=feature, user_id=request.user.id, values={"data": data}, **fields
                )
        except IntegrityError:
            pass
        return Response(status=201)

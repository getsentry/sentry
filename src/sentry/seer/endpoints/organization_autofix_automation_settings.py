from __future__ import annotations

from django.db import router, transaction
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings

OPTION_KEY = "sentry:autofix_automation_tuning"


class PutSerializer(serializers.Serializer):
    """Serializer for OrganizationAutofixAutomationSettingsEndpoint.put"""

    projectIds = serializers.ListField(
        child=serializers.IntegerField(),
        required=True,
        max_length=1000,
        help_text="List of project IDs to update settings for.",
    )
    autofixAutomationTuning = serializers.ChoiceField(
        choices=[setting.value for setting in AutofixAutomationTuningSettings],
        required=True,
        help_text="The autofix automation tuning level to set.",
    )


@region_silo_endpoint
class OrganizationAutofixAutomationSettingsEndpoint(OrganizationEndpoint):
    """Bulk endpoint for managing project autofix automation tuning settings."""

    owner = ApiOwner.ML_AI

    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (OrganizationPermission,)

    def put(self, request: Request, organization: Organization) -> Response:
        """
        Bulk update the autofix automation tuning setting of projects in a single request.

        :pparam string organization_id_or_slug: the id or slug of the
            organization.
        :auth: required
        """

        serializer = PutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data
        project_ids = set(data["projectIds"])
        setting = data["autofixAutomationTuning"]

        projects = self.get_projects(request, organization, project_ids=project_ids)

        with transaction.atomic(router.db_for_write(ProjectOption)):
            for project in projects:
                project.update_option(OPTION_KEY, setting)

        return Response(status=204)

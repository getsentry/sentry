from __future__ import annotations

from collections.abc import Mapping, MutableMapping
from typing import Any

from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request

from sentry import analytics, features
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.validators.project_codeowners import validate_codeowners_associations
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.ownership.grammar import convert_codeowners_syntax, create_schema_from_issue_owners
from sentry.utils import metrics
from sentry.utils.codeowners import MAX_RAW_LENGTH

from .analytics import *  # NOQA


class ProjectCodeOwnerSerializer(CamelSnakeModelSerializer):
    code_mapping_id = serializers.IntegerField(required=True)
    raw = serializers.CharField(required=True)
    organization_integration_id = serializers.IntegerField(required=False)
    date_updated = serializers.CharField(required=False)

    class Meta:
        model = ProjectCodeOwners
        fields = ["raw", "code_mapping_id", "organization_integration_id", "date_updated"]

    def get_max_length(self) -> int:
        return MAX_RAW_LENGTH

    def validate(self, attrs: Mapping[str, Any]) -> Mapping[str, Any]:
        # If it already exists, set default attrs with existing values
        if self.instance:
            attrs = {
                "raw": self.instance.raw,
                "code_mapping_id": self.instance.repository_project_path_config,
                **attrs,
            }

        if not attrs.get("raw", "").strip():
            return attrs

        # We want to limit `raw` to a reasonable length, so that people don't end up with values
        # that are several megabytes large. To not break this functionality for existing customers
        # we temporarily allow rows that already exceed this limit to still be updated.
        # We do something similar with ProjectOwnership at the API level.
        existing_raw = self.instance.raw if self.instance else ""
        max_length = self.get_max_length()
        if len(attrs["raw"]) > max_length and len(existing_raw) <= max_length:
            analytics.record(
                "codeowners.max_length_exceeded",
                organization_id=self.context["project"].organization.id,
            )
            raise serializers.ValidationError(
                {"raw": f"Raw needs to be <= {max_length} characters in length"}
            )

        # Ignore association errors and continue parsing CODEOWNERS for valid lines.
        # Allow users to incrementally fix association errors; for CODEOWNERS with many external mappings.
        associations, _ = validate_codeowners_associations(attrs["raw"], self.context["project"])

        issue_owner_rules = convert_codeowners_syntax(
            attrs["raw"], associations, attrs["code_mapping_id"]
        )

        # Convert IssueOwner syntax into schema syntax
        try:
            validated_data = create_schema_from_issue_owners(
                issue_owners=issue_owner_rules,
                project_id=self.context["project"].id,
                add_owner_ids=True,
            )
            return {
                **attrs,
                "schema": validated_data,
            }
        except ValidationError as e:
            raise serializers.ValidationError(str(e))

    def validate_code_mapping_id(self, code_mapping_id: int) -> RepositoryProjectPathConfig:
        if ProjectCodeOwners.objects.filter(
            repository_project_path_config=code_mapping_id
        ).exists() and (
            not self.instance
            or (self.instance.repository_project_path_config_id != code_mapping_id)
        ):
            raise serializers.ValidationError("This code mapping is already in use.")

        try:
            return RepositoryProjectPathConfig.objects.get(
                id=code_mapping_id, project=self.context["project"]
            )
        except RepositoryProjectPathConfig.DoesNotExist:
            raise serializers.ValidationError("This code mapping does not exist.")

    def create(self, validated_data: MutableMapping[str, Any]) -> ProjectCodeOwners:
        # Save projectcodeowners record
        repository_project_path_config = validated_data.pop("code_mapping_id", None)
        project = self.context["project"]
        return ProjectCodeOwners.objects.create(
            repository_project_path_config=repository_project_path_config,
            project=project,
            **validated_data,
        )

    def update(
        self, instance: ProjectCodeOwners, validated_data: MutableMapping[str, Any]
    ) -> ProjectCodeOwners:
        if "id" in validated_data:
            validated_data.pop("id")
        for key, value in validated_data.items():
            setattr(self.instance, key, value)
        self.instance.save()
        return self.instance


class ProjectCodeOwnersMixin:
    def has_feature(self, request: Request, project: Project) -> bool:
        return bool(
            features.has(
                "organizations:integrations-codeowners", project.organization, actor=request.user
            )
        )

    def track_response_code(self, type: str, status: int | str) -> None:
        if type in ["create", "update"]:
            metrics.incr(
                f"codeowners.{type}.http_response",
                sample_rate=1.0,
                tags={"status": status},
            )


from .details import ProjectCodeOwnersDetailsEndpoint
from .index import ProjectCodeOwnersEndpoint

__all__ = (
    "ProjectCodeOwnersEndpoint",
    "ProjectCodeOwnersDetailsEndpoint",
)

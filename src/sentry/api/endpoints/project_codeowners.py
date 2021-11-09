import logging
from typing import Any, Mapping, MutableMapping, Sequence, Union

from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.endpoints.project_ownership import ProjectOwnershipMixin
from sentry.api.serializers import serialize
from sentry.api.serializers.models import projectcodeowners as projectcodeowners_serializers
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.models import (
    ExternalActor,
    Project,
    ProjectCodeOwners,
    RepositoryProjectPathConfig,
    UserEmail,
)
from sentry.ownership.grammar import convert_codeowners_syntax, create_schema_from_issue_owners
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def validate_association(
    raw_items: Sequence[Union[UserEmail, ExternalActor]],
    associations: Sequence[Union[UserEmail, ExternalActor]],
    type: str,
) -> Sequence[str]:
    raw_items_set = {str(item) for item in raw_items}
    if type == "emails":
        # associations are UserEmail objects
        sentry_items = {item.email for item in associations}
    else:
        # associations are ExternalActor objects
        sentry_items = {item.external_name for item in associations}
    return list(raw_items_set.difference(sentry_items))


class ProjectCodeOwnerSerializer(CamelSnakeModelSerializer):  # type: ignore
    code_mapping_id = serializers.IntegerField(required=True)
    raw = serializers.CharField(required=True)
    organization_integration_id = serializers.IntegerField(required=False)

    class Meta:
        model = ProjectCodeOwners
        fields = ["raw", "code_mapping_id", "organization_integration_id"]

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

        # Ignore association errors and continue parsing CODEOWNERS for valid lines.
        # Allow users to incrementally fix association errors; for CODEOWNERS with many external mappings.
        associations, _ = ProjectCodeOwners.validate_codeowners_associations(
            attrs["raw"], self.context["project"]
        )

        issue_owner_rules = convert_codeowners_syntax(
            attrs["raw"], associations, attrs["code_mapping_id"]
        )

        # Convert IssueOwner syntax into schema syntax
        try:
            validated_data = create_schema_from_issue_owners(
                issue_owners=issue_owner_rules, project_id=self.context["project"].id
            )
            return {
                **attrs,
                "schema": validated_data,
            }
        except ValidationError as e:
            raise serializers.ValidationError(e)

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

    def track_response_code(self, type: str, status: str) -> None:
        if type in ["create", "update"]:
            metrics.incr(
                f"codeowners.{type}.http_response",
                sample_rate=1.0,
                tags={"status": status},
            )


class ProjectCodeOwnersEndpoint(ProjectEndpoint, ProjectOwnershipMixin, ProjectCodeOwnersMixin):  # type: ignore
    def get(self, request: Request, project: Project) -> Response:
        """
        Retrieve List of CODEOWNERS configurations for a project
        ````````````````````````````````````````````

        Return a list of a project's CODEOWNERS configuration.

        :auth: required
        """

        if not self.has_feature(request, project):
            raise PermissionDenied

        expand = request.GET.getlist("expand", [])
        expand.append("errors")

        codeowners = list(ProjectCodeOwners.objects.filter(project=project).order_by("-date_added"))

        return Response(
            serialize(
                codeowners,
                request.user,
                serializer=projectcodeowners_serializers.ProjectCodeOwnersSerializer(expand=expand),
            ),
            status.HTTP_200_OK,
        )

    def post(self, request: Request, project: Project) -> Response:
        """
        Upload a CODEOWNERS for project
        `````````````

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project to get.
        :param string raw: the raw CODEOWNERS text
        :param string codeMappingId: id of the RepositoryProjectPathConfig object
        :auth: required
        """
        if not self.has_feature(request, project):
            self.track_response_code("create", PermissionDenied.status_code)
            raise PermissionDenied

        serializer = ProjectCodeOwnerSerializer(
            context={
                "ownership": self.get_ownership(project),
                "project": project,
            },
            data={**request.data},
        )

        if serializer.is_valid():
            project_codeowners = serializer.save()
            self.track_response_code("create", status.HTTP_201_CREATED)
            analytics.record(
                "codeowners.created",
                user_id=request.user.id if request.user and request.user.id else None,
                organization_id=project.organization_id,
                project_id=project.id,
                codeowners_id=project_codeowners.id,
            )
            return Response(
                serialize(
                    project_codeowners,
                    request.user,
                    serializer=projectcodeowners_serializers.ProjectCodeOwnersSerializer(
                        expand=["ownershipSyntax", "errors"]
                    ),
                ),
                status=status.HTTP_201_CREATED,
            )

        self.track_response_code("create", status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

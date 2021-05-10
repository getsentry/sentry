import logging
from typing import Any, List, Mapping, MutableMapping, Sequence, Union

from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.endpoints.project_ownership import ProjectOwnershipMixin, ProjectOwnershipSerializer
from sentry.api.serializers import serialize
from sentry.api.serializers.models import projectcodeowners as projectcodeowners_serializers
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.models import (
    ExternalActor,
    Project,
    ProjectCodeOwners,
    RepositoryProjectPathConfig,
    UserEmail,
    actor_type_to_string,
)
from sentry.ownership.grammar import convert_codeowners_syntax, parse_code_owners
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def validate_association(
    raw_items: Sequence[Union[UserEmail, ExternalActor]],
    associations: Sequence[Union[UserEmail, ExternalActor]],
    type: str,
) -> Sequence[str]:
    if type == "emails":
        # associations are UserEmail objects
        sentry_items = [item.email for item in associations]
    else:
        # associations are ExternalActor objects
        sentry_items = [item.external_name for item in associations]

    diff = [str(item) for item in raw_items if item not in sentry_items]
    unique_diff = list(dict.fromkeys(diff).keys())

    if len(unique_diff):
        return [
            f'The following {type} do not have an association in Sentry: {", ".join(unique_diff)}.'
        ]

    return []


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

        external_association_err: List[str] = []
        # Get list of team/user names from CODEOWNERS file
        team_names, usernames, emails = parse_code_owners(attrs["raw"])

        # Check if there exists Sentry users with the emails listed in CODEOWNERS
        user_emails = UserEmail.objects.filter(
            email__in=emails,
            user__sentry_orgmember_set__organization=self.context["project"].organization,
        )

        user_emails_diff = validate_association(emails, user_emails, "emails")
        external_association_err.extend(user_emails_diff)

        # Check if the usernames have an association
        external_actors = ExternalActor.objects.filter(
            external_name__in=usernames + team_names,
            organization=self.context["project"].organization,
        )

        external_users_diff = validate_association(usernames, external_actors, "usernames")
        external_association_err.extend(external_users_diff)

        external_teams_diff = validate_association(team_names, external_actors, "team names")
        external_association_err.extend(external_teams_diff)

        if len(external_association_err):
            raise serializers.ValidationError({"raw": "\n".join(external_association_err)})

        # Convert CODEOWNERS into IssueOwner syntax
        users_dict = {}
        teams_dict = {}
        for external_actor in external_actors:
            type = actor_type_to_string(external_actor.actor.type)
            if type == "user":
                user = external_actor.actor.resolve()
                users_dict[external_actor.external_name] = user.email
            elif type == "team":
                team = external_actor.actor.resolve()
                teams_dict[external_actor.external_name] = f"#{team.slug}"

        emails_dict = {email: email for email in emails}
        associations = {**users_dict, **teams_dict, **emails_dict}

        issue_owner_rules = convert_codeowners_syntax(
            attrs["raw"], associations, attrs["code_mapping_id"]
        )

        # Convert IssueOwner syntax into schema syntax
        validated_data = ProjectOwnershipSerializer(context=self.context).validate(
            {"raw": issue_owner_rules}
        )

        return {**validated_data, **attrs}

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
        codeowners = list(ProjectCodeOwners.objects.filter(project=project))

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
        Upload a CODEWONERS for project
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
            context={"ownership": self.get_ownership(project), "project": project},
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
                serialize(project_codeowners, request.user), status=status.HTTP_201_CREATED
            )

        self.track_response_code("create", status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

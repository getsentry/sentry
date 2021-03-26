import logging

from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import (
    ProjectCodeOwners,
    ExternalUser,
    ExternalTeam,
    RepositoryProjectPathConfig,
    UserEmail,
)
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.ownership.grammar import (
    parse_code_owners,
    convert_codeowners_syntax,
)

from sentry.api.endpoints.project_ownership import ProjectOwnershipSerializer, ProjectOwnershipMixin

logger = logging.getLogger(__name__)


class ProjectCodeOwnerSerializer(CamelSnakeModelSerializer):
    code_mapping_id = serializers.IntegerField(required=True)
    raw = serializers.CharField(required=True)
    organization_integration_id = serializers.IntegerField(required=False)

    class Meta:
        model = ProjectCodeOwners
        fields = ["raw", "code_mapping_id", "organization_integration_id"]

    def validate(self, attrs):
        # If it already exists, set default attrs with existing values
        if self.instance:
            attrs = {
                "raw": self.instance.raw,
                "code_mapping_id": self.instance.repository_project_path_config,
                **attrs,
            }

        if not attrs.get("raw", "").strip():
            return attrs
        external_association_err = []
        # Get list of team/user names from CODEOWNERS file
        teamnames, usernames, emails = parse_code_owners(attrs["raw"])

        # Check if there exists Sentry users with the emails listed in CODEOWNERS
        user_emails = UserEmail.objects.filter(email__in=emails)
        user_emails_diff = self._validate_association(emails, user_emails, "emails")

        external_association_err.extend(user_emails_diff)

        # Check if the usernames have an association
        external_users = ExternalUser.objects.filter(
            external_name__in=usernames,
            organizationmember__organization=self.context["project"].organization,
        )

        external_users_diff = self._validate_association(usernames, external_users, "usernames")

        external_association_err.extend(external_users_diff)

        # Check if the team names have an association
        external_teams = ExternalTeam.objects.filter(
            external_name__in=teamnames,
            team__organization=self.context["project"].organization,
        )

        external_teams_diff = self._validate_association(teamnames, external_teams, "team names")

        external_association_err.extend(external_teams_diff)

        if len(external_association_err):
            raise serializers.ValidationError({"raw": "\n".join(external_association_err)})

        # Convert CODEOWNERS into IssueOwner syntax
        users_dict = {
            user.external_name: user.organizationmember.user.email for user in external_users
        }
        teams_dict = {team.external_name: f"#{team.team.slug}" for team in external_teams}
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

    def _validate_association(self, raw_items, associations, type):
        if type == "emails":
            # associations are UserEmail objects
            sentry_items = [item.email for item in associations]
        else:
            # associations can be ExternalUser or ExternalTeam objects
            sentry_items = [item.external_name for item in associations]

        diff = [item for item in raw_items if item not in sentry_items]

        if len(diff):
            return [
                f'The following {type} do not have an association in Sentry: {", ".join(diff)}.'
            ]

        return []

    def validate_code_mapping_id(self, code_mapping_id):
        try:
            return RepositoryProjectPathConfig.objects.get(
                id=code_mapping_id, project=self.context["project"]
            )
        except RepositoryProjectPathConfig.DoesNotExist:
            raise serializers.ValidationError("This code mapping does not exist.")

    def create(self, validated_data):
        # Save projectcodeowners record
        repository_project_path_config = validated_data.pop("code_mapping_id", None)
        project = self.context["project"]
        return ProjectCodeOwners.objects.create(
            repository_project_path_config=repository_project_path_config,
            project=project,
            **validated_data,
        )

    def update(self, instance, validated_data):
        if "id" in validated_data:
            validated_data.pop("id")
        for key, value in validated_data.items():
            setattr(self.instance, key, value)
        self.instance.save()
        return self.instance


class ProjectCodeOwnersMixin:
    def has_feature(self, request, project):
        return features.has(
            "organizations:import-codeowners", project.organization, actor=request.user
        )


class ProjectCodeOwnersEndpoint(ProjectEndpoint, ProjectOwnershipMixin, ProjectCodeOwnersMixin):
    def get(self, request, project):
        """
        Retrieve List of CODEOWNERS configurations for a project
        ````````````````````````````````````````````

        Return a list of a project's CODEOWNERS configuration.

        :auth: required
        """

        if not self.has_feature(request, project):
            raise PermissionDenied

        codeowners = list(ProjectCodeOwners.objects.filter(project=project))

        return Response(serialize(codeowners, request.user), status.HTTP_200_OK)

    def post(self, request, project):
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
            raise PermissionDenied

        serializer = ProjectCodeOwnerSerializer(
            context={"ownership": self.get_ownership(project), "project": project},
            data={**request.data},
        )
        if serializer.is_valid():
            project_codeowners = serializer.save()
            return Response(
                serialize(project_codeowners, request.user), status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

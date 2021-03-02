import logging

from django.db import IntegrityError
from django.utils import timezone

from rest_framework import serializers, status
from rest_framework.response import Response

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
        user_emails = [user.email for user in user_emails]
        user_emails_diff = [email for email in emails if email not in user_emails]

        if len(user_emails_diff):
            external_association_err.append(
                f'The following emails do not have an user associated in Sentry: {", ".join(user_emails_diff)}.'
            )

        # Check if the usernames have an association
        external_users = ExternalUser.objects.filter(
            external_name__in=usernames,
            organizationmember__organization=self.context["project"].organization,
        )

        external_users_names = [user.external_name for user in external_users]
        external_users_diff = [name for name in usernames if name not in external_users_names]

        if len(external_users_diff):
            external_association_err.append(
                f'The following usernames do not have an association in Sentry: {", ".join(external_users_diff)}.'
            )

        # Check if the team names have an association
        external_teams = ExternalTeam.objects.filter(
            external_name__in=teamnames,
            team__organization=self.context["project"].organization,
        )

        external_teams_names = [team.external_name for team in external_teams]
        external_teams_diff = [name for name in teamnames if name not in external_teams_names]

        if len(external_teams_diff):
            external_association_err.append(
                f'The following team names do not have an association in Sentry: {", ".join(external_teams_diff)}.'
            )

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

    def validate_code_mapping_id(self, code_mapping_id):
        try:
            return RepositoryProjectPathConfig.objects.get(
                id=code_mapping_id, project=self.context["project"]
            )
        except RepositoryProjectPathConfig.DoesNotExist:
            raise serializers.ValidationError("This code mapping does not exist.")

    def create(self, validated_data):
        # Create a project_ownership record with default values if none exists.
        ownership = self.context["ownership"]
        if ownership.id is None:
            now = timezone.now()
            ownership.date_created = now
            ownership.last_updated = now
            ownership.save()

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
        try:
            self.instance.save()
            return self.instance
        except IntegrityError:
            raise serializers.ValidationError(
                "There already exists an external user association with this external_name and provider."
            )


class ProjectCodeOwnersEndpoint(ProjectEndpoint, ProjectOwnershipMixin):
    def get(self, request, project):
        """
        Retrieve List of CODEOWNERS configurations for a project
        ````````````````````````````````````````````

        Return a list of a project's CODEOWNERS configuration.

        :auth: required
        """
        codeowners = list(ProjectCodeOwners.objects.filter(project=project))

        return Response(serialize(codeowners, request.user), status.HTTP_200_OK)

    def post(self, request, project):
        """
        Upload a CODEWONERS for project
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          file belongs to.
        :pparam string project_slug: the slug of the project to get.
        :param string raw: the raw CODEOWNERS text
        :param string codeMappingId: id of the RepositoryProjectPathConfig object
        :auth: required
        """
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

import random
import string

from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ValidationError

from sentry import audit_log, features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.endpoints.team_projects import ProjectSerializer
from sentry.api.exceptions import ConflictError, ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Project
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team
from sentry.signals import project_created, team_created
from sentry.utils.snowflake import MaxSnowflakeRetryError

CONFLICTING_TEAM_SLUG_ERROR = "A team with this slug already exists."
MISSING_PERMISSION_ERROR_STRING = "You do not have permission to join a new team as a Team Admin."


def generate_three_letter_string():
    letters = string.ascii_lowercase
    return "".join(random.choice(letters) for _ in range(3))


# This endpoint is intented to be available to all members of an
# organization so we include "project:read" in the POST scopes.


class OrgProjectPermission(OrganizationPermission):
    scope_map = {
        "POST": ["project:read", "project:write", "project:admin"],
    }


@region_silo_endpoint
class OrganizationProjectsExperimentEndpoint(OrganizationEndpoint):
    permission_classes = (OrgProjectPermission,)

    def should_add_creator_to_team(self, request: Request):
        return request.user.is_authenticated

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create a new Team and Project
        ``````````````````

        Create a new team where the user is set as Team Admin. The
        name+slug of the team is automatically set as 'default-team-[username]'.
        If this is taken, a random three letter suffix is added as needed
        (eg: ...-gnm, ...-zls). Then create a new project bound to this team

        :pparam string organization_slug: the slug of the organization the
                                          team should be created for.
        :qparam string name: the name for the new project.
        :qparam string platform: the optional platform that this project is for.
        :qparam bool default_rules: create default rules (defaults to True)
        :auth: required
        """
        serializer = ProjectSerializer(data=request.data)

        if not serializer.is_valid():
            raise ValidationError(serializer.errors)
        if not self.should_add_creator_to_team(request):
            raise ValidationError(
                {"detail": MISSING_PERMISSION_ERROR_STRING},
            )

        result = serializer.validated_data

        if not features.has("organizations:team-roles", organization) or not features.has(
            "organizations:team-project-creation-all", organization
        ):
            raise ResourceDoesNotExist(detail=MISSING_PERMISSION_ERROR_STRING)

        default_team_slug = f"default-team-{request.user.username}"
        suffixed_team_slug = default_team_slug

        # add suffix to default team name until name is available
        while Team.objects.filter(organization=organization, slug=suffixed_team_slug).exists():
            suffixed_team_slug = f"{default_team_slug}-{generate_three_letter_string()}"
        default_team_slug = suffixed_team_slug

        try:
            with transaction.atomic():
                team = Team.objects.create(
                    name=default_team_slug,
                    slug=default_team_slug,
                    idp_provisioned=result.get("idp_provisioned", False),
                    organization=organization,
                    through_project_creation=True,
                )
                member = OrganizationMember.objects.get(
                    user=request.user, organization=organization
                )
                OrganizationMemberTeam.objects.create(
                    team=team,
                    organizationmember=member,
                    role="admin",
                )
                project = Project.objects.create(
                    name=result["name"],
                    # slug is set to None to avoid a duplicate slug error
                    slug=None,
                    organization=organization,
                    platform=result.get("platform"),
                )
        except (IntegrityError, MaxSnowflakeRetryError):
            # We can only catch duplicate team slugs here. Duplicate project slugs are
            # impossible because the project slug is always generated based on the project name.
            # If the generated slug is already in use, the system automatically adds a suffix
            # to make it unique.
            raise ConflictError(
                {
                    "non_field_errors": [CONFLICTING_TEAM_SLUG_ERROR],
                    "detail": CONFLICTING_TEAM_SLUG_ERROR,
                }
            )
        except OrganizationMember.DoesNotExist:
            raise PermissionDenied(
                detail="You must be a member of the organization to join a new team as a Team Admin"
            )
        else:
            project.add_team(team)

        team_created.send_robust(
            organization=organization,
            user=request.user,
            team=team,
            sender=self.__class__,
        )
        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=team.id,
            event=audit_log.get_event_id("TEAM_ADD"),
            data=team.get_audit_log_data(),
        )
        self.create_audit_entry(
            request=request,
            organization=team.organization,
            target_object=project.id,
            event=audit_log.get_event_id("PROJECT_ADD"),
            data=project.get_audit_log_data(),
        )
        project_created.send(
            project=project,
            user=request.user,
            default_rules=result.get("default_rules", True),
            sender=self,
        )

        return Response(serialize(project, request.user), status=201)

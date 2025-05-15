from __future__ import annotations

from collections.abc import Collection, Iterable, Mapping
from typing import Any

from django.db.models import Subquery

from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.issues.ownership.grammar import parse_code_owners
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.users.services.user.service import user_service


def validate_association_emails(
    raw_items: Collection[str],
    associations: Collection[str],
) -> list[str]:
    return list(set(raw_items).difference(associations))


def validate_association_actors(
    raw_items: Collection[str],
    associations: Iterable[ExternalActor],
) -> list[str]:
    raw_items_set = {str(item) for item in raw_items}
    # associations are ExternalActor objects
    sentry_items = {item.external_name for item in associations}
    return list(raw_items_set.difference(sentry_items))


def validate_codeowners_associations(
    codeowners: str, project: Project
) -> tuple[Mapping[str, Any], Mapping[str, Any]]:
    # Get list of team/user names from CODEOWNERS file
    team_names, usernames, emails = parse_code_owners(codeowners)

    # Check if there exists Sentry users with the emails listed in CODEOWNERS
    users = user_service.get_many(
        filter=dict(emails=emails, organization_id=project.organization_id)
    )

    # Check if the usernames/teamnames have an association
    external_actors = ExternalActor.objects.filter(
        external_name__in=usernames + team_names,
        organization_id=project.organization_id,
        provider__in=[
            ExternalProviders.GITHUB.value,
            ExternalProviders.GITHUB_ENTERPRISE.value,
            ExternalProviders.GITLAB.value,
        ],
    )

    # Convert CODEOWNERS into IssueOwner syntax
    users_dict = {}
    teams_dict = {}
    teams_without_access = []
    users_without_access = []

    team_ids_to_external_names: Mapping[int, str] = {
        xa.team_id: xa.external_name for xa in external_actors if xa.team_id is not None
    }
    user_ids_to_external_names: Mapping[int, str] = {
        xa.user_id: xa.external_name for xa in external_actors if xa.user_id is not None
    }

    for user in user_service.get_many(
        filter=dict(user_ids=list(user_ids_to_external_names.keys()))
    ):
        organization_members_ids = OrganizationMember.objects.filter(
            user_id=user.id, organization_id=project.organization_id
        ).values_list("id", flat=True)
        team_ids = OrganizationMemberTeam.objects.filter(
            organizationmember_id__in=Subquery(organization_members_ids)
        ).values_list("team_id", flat=True)
        projects = Project.objects.get_for_team_ids(Subquery(team_ids))

        if project in projects:
            users_dict[user_ids_to_external_names[user.id]] = user.email
        else:
            users_without_access.append(f"{user.get_display_name()}")

    for team in Team.objects.filter(id__in=list(team_ids_to_external_names.keys())):
        # make sure the sentry team has access to the project
        # tied to the codeowner
        if project in team.get_projects():
            teams_dict[team_ids_to_external_names[team.id]] = f"#{team.slug}"
        else:
            teams_without_access.append(f"#{team.slug}")

    emails_dict = {}
    user_emails = set()
    for user in users:
        for user_email in user.emails:
            emails_dict[user_email] = user_email
            user_emails.add(user_email)

    associations = {**users_dict, **teams_dict, **emails_dict}

    errors = {
        "missing_user_emails": validate_association_emails(emails, user_emails),
        "missing_external_users": validate_association_actors(usernames, external_actors),
        "missing_external_teams": validate_association_actors(team_names, external_actors),
        "teams_without_access": teams_without_access,
        "users_without_access": users_without_access,
    }
    return associations, errors

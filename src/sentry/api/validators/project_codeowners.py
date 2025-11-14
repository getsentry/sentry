from __future__ import annotations

from collections import defaultdict
from collections.abc import Collection, Mapping, Sequence
from functools import reduce
from operator import or_
from typing import int, Any

from django.db.models import Subquery
from django.db.models.query_utils import Q

from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.issues.ownership.grammar import parse_code_owners
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.users.services.user.service import user_service


def find_missing_associations(
    parsed_items: Sequence[str],
    associated_items: Collection[str],
) -> list[str]:
    return list(set(parsed_items).difference(associated_items))


def build_codeowners_associations(
    codeowners: str, project: Project
) -> tuple[Mapping[str, Any], Mapping[str, Any]]:
    """
    Build a dict of {external_name: sentry_name} associations for a raw codeowners file.
    Returns only the actors that exist and have access to the project.
    """
    # Get list of team/user names from CODEOWNERS file
    team_names, usernames, emails = parse_code_owners(codeowners)

    # Check if there exists Sentry users with the emails listed in CODEOWNERS
    users = user_service.get_many(
        filter=dict(emails=emails, organization_id=project.organization_id)
    )

    # GitHub team and user names are case-insensitive
    # We build a query that filters on each name we parsed case-insensitively
    queries = [Q(external_name__iexact=xname) for xname in usernames + team_names]
    if queries:
        query = reduce(or_, queries)
        external_actors = ExternalActor.objects.filter(
            query,
            organization_id=project.organization_id,
            provider__in=[
                ExternalProviders.GITHUB.value,
                ExternalProviders.GITHUB_ENTERPRISE.value,
                ExternalProviders.GITLAB.value,
            ],
        )
    else:
        external_actors = ExternalActor.objects.none()

    # Convert CODEOWNERS into IssueOwner syntax
    users_dict = {}
    teams_dict = {}

    teams_without_access = set()
    teams_without_access_external_names = set()
    users_without_access = set()
    users_without_access_external_names = set()

    team_ids_to_external_names: dict[int, list[str]] = defaultdict(list)
    user_ids_to_external_names: dict[int, list[str]] = defaultdict(list)

    for xa in external_actors:
        if xa.team_id is not None:
            team_ids_to_external_names[xa.team_id].extend(
                filter(lambda team_name: team_name.lower() == xa.external_name.lower(), team_names)
            )
        if xa.user_id is not None:
            user_ids_to_external_names[xa.user_id].extend(
                filter(lambda username: username.lower() == xa.external_name.lower(), usernames)
            )

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
            for external_name in user_ids_to_external_names[user.id]:
                users_dict[external_name] = user.email
        else:
            users_without_access.add(f"{user.get_display_name()}")
            users_without_access_external_names.update(user_ids_to_external_names[user.id])

    for team in Team.objects.filter(id__in=list(team_ids_to_external_names.keys())):
        # make sure the sentry team has access to the project
        # tied to the codeowner
        if project in team.get_projects():
            for external_name in team_ids_to_external_names[team.id]:
                teams_dict[external_name] = f"#{team.slug}"
        else:
            teams_without_access.add(f"#{team.slug}")
            teams_without_access_external_names.update(team_ids_to_external_names[team.id])

    emails_dict = {}
    user_emails = set()
    for user in users:
        for user_email in user.emails:
            emails_dict[user_email] = user_email
            user_emails.add(user_email)

    associations = {**users_dict, **teams_dict, **emails_dict}

    errors = {
        "missing_user_emails": find_missing_associations(emails, user_emails),
        "missing_external_users": find_missing_associations(
            usernames, set(associations.keys()) | users_without_access_external_names
        ),
        "missing_external_teams": find_missing_associations(
            team_names, set(associations.keys()) | teams_without_access_external_names
        ),
        "teams_without_access": list(teams_without_access),
        "users_without_access": list(users_without_access),
    }
    return associations, errors

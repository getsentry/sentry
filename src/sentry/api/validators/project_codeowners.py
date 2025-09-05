from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence
from functools import reduce
from operator import or_
from typing import Any

from django.db.models import Subquery
from django.db.models.query_utils import Q

from sentry import features
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
    raw_items: Sequence[str],
    associations: Sequence[str],
) -> list[str]:
    return list(set(raw_items).difference(associations))


def validate_codeowners_associations(
    codeowners: str, project: Project
) -> tuple[Mapping[str, Any], Mapping[str, Any]]:
    # Get list of team/user names from CODEOWNERS file
    team_names, usernames, emails = parse_code_owners(codeowners)

    # Check if there exists Sentry users with the emails listed in CODEOWNERS
    users = user_service.get_many(
        filter=dict(emails=emails, organization_id=project.organization_id)
    )

    if features.has("organizations:use-case-insensitive-codeowners", project.organization):
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
    else:
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
    teams_without_access_external_names = []
    users_without_access = []
    users_without_access_external_names = []

    team_ids_to_external_names: dict[int, list[str]] = {}
    user_ids_to_external_names: dict[int, list[str]] = {}

    for xa in external_actors:
        if xa.team_id is not None:
            if xa.team_id not in team_ids_to_external_names:
                team_ids_to_external_names[xa.team_id] = []
            team_ids_to_external_names[xa.team_id].extend(
                filter(lambda team_name: team_name.lower() == xa.external_name.lower(), team_names)
            )
        if xa.user_id is not None:
            if xa.user_id not in user_ids_to_external_names:
                user_ids_to_external_names[xa.user_id] = []
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
            users_without_access.append(f"{user.get_display_name()}")
            users_without_access_external_names.extend(user_ids_to_external_names[user.id])

    for team in Team.objects.filter(id__in=list(team_ids_to_external_names.keys())):
        # make sure the sentry team has access to the project
        # tied to the codeowner
        if project in team.get_projects():
            for external_name in team_ids_to_external_names[team.id]:
                teams_dict[external_name] = f"#{team.slug}"
        else:
            teams_without_access.append(f"#{team.slug}")
            teams_without_access_external_names.extend(team_ids_to_external_names[team.id])

    emails_dict = {}
    user_emails = set()
    for user in users:
        for user_email in user.emails:
            emails_dict[user_email] = user_email
            user_emails.add(user_email)

    associations = {**users_dict, **teams_dict, **emails_dict}

    errors = {
        "missing_user_emails": validate_association_emails(emails, user_emails),
        "missing_external_users": validate_association_actors(
            usernames, list(associations.keys()) + users_without_access_external_names
        ),
        "missing_external_teams": validate_association_actors(
            team_names, list(associations.keys()) + teams_without_access_external_names
        ),
        "teams_without_access": teams_without_access,
        "users_without_access": users_without_access,
    }
    return associations, errors

from __future__ import annotations

from collections import defaultdict
from collections.abc import Collection, Mapping, Sequence
from typing import Any

from django.db.models.functions import Lower

from sentry.constants import ObjectStatus
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

    # GitHub team and user names are case-insensitive.
    # Deduplicate and lowercase names, then use a single IN query to filter.
    unique_lower_names = {name.lower() for name in usernames + team_names}
    if unique_lower_names:
        external_actors = ExternalActor.objects.annotate(
            external_name_lower=Lower("external_name")
        ).filter(
            external_name_lower__in=unique_lower_names,
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

    # Pre-build lowercase -> original name mappings
    lower_to_team_names: dict[str, list[str]] = defaultdict(list)
    for name in team_names:
        lower_to_team_names[name.lower()].append(name)
    lower_to_usernames: dict[str, list[str]] = defaultdict(list)
    for name in usernames:
        lower_to_usernames[name.lower()].append(name)

    for xa in external_actors:
        xa_lower = xa.external_name.lower()
        if xa.team_id is not None:
            team_ids_to_external_names[xa.team_id].extend(lower_to_team_names.get(xa_lower, []))
        if xa.user_id is not None:
            user_ids_to_external_names[xa.user_id].extend(lower_to_usernames.get(xa_lower, []))

    # Determine which matched users have project access via team membership
    user_ids_with_access: set[int] = set()
    user_ids = list(user_ids_to_external_names.keys())
    if user_ids and project.status == ObjectStatus.ACTIVE:
        om_rows = list(
            OrganizationMember.objects.filter(
                user_id__in=user_ids,
                organization_id=project.organization_id,
            ).values_list("id", "user_id")
        )
        om_id_to_user_id = {om_id: uid for om_id, uid in om_rows}

        omt_rows = OrganizationMemberTeam.objects.filter(
            organizationmember_id__in=list(om_id_to_user_id.keys())
        ).values_list("organizationmember_id", "team_id")

        user_team_ids: dict[int, set[int]] = defaultdict(set)
        for om_id, team_id in omt_rows:
            user_team_ids[om_id_to_user_id[om_id]].add(team_id)

        all_team_ids = {tid for tids in user_team_ids.values() for tid in tids}
        project_team_ids = set(
            project.teams.filter(id__in=all_team_ids).values_list("id", flat=True)
        )
        user_ids_with_access = {
            uid for uid, tids in user_team_ids.items() if tids & project_team_ids
        }

    for user in user_service.get_many(filter=dict(user_ids=user_ids)):
        if user.id in user_ids_with_access:
            for external_name in user_ids_to_external_names[user.id]:
                users_dict[external_name] = user.email
        else:
            users_without_access.add(f"{user.get_display_name()}")
            users_without_access_external_names.update(user_ids_to_external_names[user.id])

    # Determine which matched teams have project access
    team_ids_list = list(team_ids_to_external_names.keys())
    team_ids_with_access = (
        set(project.teams.filter(id__in=team_ids_list).values_list("id", flat=True))
        if team_ids_list and project.status == ObjectStatus.ACTIVE
        else set()
    )

    for team in Team.objects.filter(id__in=team_ids_list):
        if team.id in team_ids_with_access:
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

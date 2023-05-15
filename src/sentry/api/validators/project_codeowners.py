from __future__ import annotations

from typing import TYPE_CHECKING, Any, Mapping, Sequence

from django.db.models import Subquery

from sentry.models import (
    ExternalActor,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    UserEmail,
    actor_type_to_string,
)
from sentry.ownership.grammar import parse_code_owners
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.user import RpcUser


def validate_association(
    raw_items: Sequence[UserEmail | ExternalActor],
    associations: Sequence[UserEmail | ExternalActor],
    type: str,
) -> Sequence[str]:
    raw_items_set = {str(item) for item in raw_items}
    if type == "emails":
        # associations email strings
        sentry_items = associations
    else:
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
        provider__in=[ExternalProviders.GITHUB.value, ExternalProviders.GITLAB.value],
    ).select_related("actor")

    # Convert CODEOWNERS into IssueOwner syntax
    users_dict = {}
    teams_dict = {}
    teams_without_access = []
    users_without_access = []
    for external_actor in external_actors:
        type = actor_type_to_string(external_actor.actor.type)
        if type == "user":
            user: RpcUser = external_actor.actor.resolve()
            organization_members_ids = OrganizationMember.objects.filter(
                user_id=user.id, organization_id=project.organization_id
            ).values_list("id", flat=True)
            team_ids = OrganizationMemberTeam.objects.filter(
                organizationmember_id__in=Subquery(organization_members_ids)
            ).values_list("team_id", flat=True)
            projects = Project.objects.get_for_team_ids(Subquery(team_ids))

            if project in projects:
                users_dict[external_actor.external_name] = user.email
            else:
                users_without_access.append(f"{user.get_display_name()}")
        elif type == "team":
            team = external_actor.actor.resolve()
            # make sure the sentry team has access to the project
            # tied to the codeowner
            if project in team.get_projects():
                teams_dict[external_actor.external_name] = f"#{team.slug}"
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
        "missing_user_emails": validate_association(emails, user_emails, "emails"),
        "missing_external_users": validate_association(usernames, external_actors, "usernames"),
        "missing_external_teams": validate_association(team_names, external_actors, "team names"),
        "teams_without_access": teams_without_access,
        "users_without_access": users_without_access,
    }
    return associations, errors

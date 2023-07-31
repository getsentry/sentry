from django.db.models.signals import pre_delete, pre_save
from rest_framework.serializers import ValidationError

from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.roles import organization_roles


def _assert_org_has_owner_not_from_team(organization, top_role):
    if not organization.member_set.filter(role=top_role).exists():
        raise ValidationError(detail="An organization must have at least one owner")


def prevent_demoting_last_owner(instance: OrganizationMember, **kwargs):
    # if a member is being created
    if instance.id is None:
        return  # type: ignore[unreachable]

    try:
        member = OrganizationMember.objects.get(id=instance.id)
    except OrganizationMember.DoesNotExist:
        return

    # member is the last owner and the update will remove the last owner
    if (
        member.is_only_owner()
        and organization_roles.get_top_dog().id not in instance.get_all_org_roles()
    ):
        raise ValidationError(detail="An organization must have at least one owner")


def prevent_demoting_last_owner_team(instance: Team, **kwargs):
    # if a team is being created
    if instance.id is None:
        return  # type: ignore[unreachable]

    try:
        team = Team.objects.get(id=instance.id)
    except Team.DoesNotExist:
        return

    organization = Organization.objects.get_from_cache(id=team.organization_id)
    top_role = organization_roles.get_top_dog().id

    all_owner_teams = organization.get_teams_with_org_roles(roles=[top_role])

    # demoting last owner team
    if len(all_owner_teams) == 1 and team.org_role == top_role and instance.org_role != top_role:
        _assert_org_has_owner_not_from_team(organization, top_role)


def prevent_removing_last_owner_team(instance: Team, **kwargs):
    organization = Organization.objects.get_from_cache(id=instance.organization_id)
    top_role = organization_roles.get_top_dog().id

    all_owner_teams = organization.get_teams_with_org_roles(roles=[top_role])

    # removing last owner team
    if len(all_owner_teams) == 1:
        _assert_org_has_owner_not_from_team(organization, top_role)


pre_save.connect(
    prevent_demoting_last_owner,
    sender=OrganizationMember,
    dispatch_uid="prevent_demoting_last_owner",
    weak=False,
)
pre_save.connect(
    prevent_demoting_last_owner_team,
    sender=Team,
    dispatch_uid="prevent_demoting_last_owner_team",
    weak=False,
)
pre_delete.connect(
    prevent_removing_last_owner_team,
    sender=Team,
    dispatch_uid="prevent_deleting_last_owner_team",
    weak=False,
)

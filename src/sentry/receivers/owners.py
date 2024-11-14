from django.db.models.signals import pre_save
from rest_framework.serializers import ValidationError

from sentry.models.organizationmember import OrganizationMember


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
    if member.is_only_owner() and instance.role != "owner":
        raise ValidationError(detail="An organization must have at least one owner")


pre_save.connect(
    prevent_demoting_last_owner,
    sender=OrganizationMember,
    dispatch_uid="prevent_demoting_last_owner",
    weak=False,
)

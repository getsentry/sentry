from django.conf import settings
from rest_framework import serializers

from sentry import features, roles
from sentry.models import AuditLogEntryEvent, InviteStatus
from sentry.signals import member_invited
from sentry.utils.audit import create_audit_entry_from_user

ERR_CANNOT_INVITE = "Your organization is not allowed to invite members."
ERR_JOIN_REQUESTS_DISABLED = "Your organization does not allow requests to join."


def validate_invitation(member, organization, user_to_approve, allowed_roles):
    """
    Validates whether an org has the options to invite members, handle join requests,
    and that the member role doesn't exceed the allowed roles to invite.
    """
    if not features.has("organizations:invite-members", organization, actor=user_to_approve):
        raise serializers.ValidationError(ERR_CANNOT_INVITE)

    if (
        organization.get_option("sentry:join_requests") is False
        and member.invite_status == InviteStatus.REQUESTED_TO_JOIN.value
    ):
        raise serializers.ValidationError(ERR_JOIN_REQUESTS_DISABLED)

    # members cannot invite roles higher than their own
    if member.role not in {r.id for r in allowed_roles}:
        raise serializers.ValidationError(
            f"You do not have permission approve a member invitation with the role {member.role}."
        )


def approve_member_invitation(
    member, user_to_approve, api_key=None, ip_address=None, referrer=None
):
    """
    Approve a member invite/join request and send an audit log entry
    """
    member.approve_invite()
    member.save()

    if settings.SENTRY_ENABLE_INVITES:
        member.send_invite_email()
        member_invited.send_robust(
            member=member,
            user=user_to_approve,
            sender=approve_member_invitation,
            referrer=referrer,
        )

    create_audit_entry_from_user(
        user_to_approve,
        api_key,
        ip_address,
        organization_id=member.organization_id,
        target_object=member.id,
        data=member.get_audit_log_data(),
        event=AuditLogEntryEvent.MEMBER_INVITE
        if settings.SENTRY_ENABLE_INVITES
        else AuditLogEntryEvent.MEMBER_ADD,
    )


def reject_member_invitation(
    member,
    user_to_approve,
    api_key=None,
    ip_address=None,
):
    """
    Reject a member invite/jin request and send an audit log entry
    """
    member.delete()

    create_audit_entry_from_user(
        user_to_approve,
        api_key,
        ip_address,
        organization_id=member.organization_id,
        target_object=member.id,
        data=member.get_audit_log_data(),
        event=AuditLogEntryEvent.INVITE_REQUEST_REMOVE,
    )


def get_allowed_roles_for_member(member):
    """
    Return a list of roles which that member could invite
    Must check if member member has member:admin first before checking
    """
    return [r for r in roles.get_all() if r.priority <= roles.get(member.role).priority]

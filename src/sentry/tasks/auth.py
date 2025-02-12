from __future__ import annotations

import abc
import logging

from django.db import router
from django.db.models import F

from sentry import audit_log, options
from sentry.auth import manager
from sentry.auth.exceptions import ProviderNotRegistered
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.organizations.services.organization.service import organization_service
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.tasks.base import instrumented_task, retry
from sentry.types.region import RegionMappingNotFound
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.audit import create_audit_entry_from_user
from sentry.utils.email import MessageBuilder

logger = logging.getLogger("sentry.auth")


@instrumented_task(
    name="sentry.tasks.send_sso_link_emails_control",
    queue="auth.control",
    silo_mode=SiloMode.CONTROL,
)
def email_missing_links_control(org_id: int, actor_id: int, provider_key: str, **kwargs):
    # This seems dumb as the region method is the same, but we need to keep
    # queues separate so that the transition from monolith to siloed is clean
    _email_missing_links(org_id=org_id, sending_user_id=actor_id, provider_key=provider_key)


@instrumented_task(name="sentry.tasks.send_sso_link_emails", queue="auth")
def email_missing_links(org_id: int, actor_id: int, provider_key: str, **kwargs):
    _email_missing_links(org_id=org_id, sending_user_id=actor_id, provider_key=provider_key)


def _email_missing_links(org_id: int, sending_user_id: int, provider_key: str) -> None:
    user = user_service.get_user(user_id=sending_user_id)
    if not user:
        logger.warning(
            "sso.link.email_failure.could_not_find_user", extra={"user_id": sending_user_id}
        )
        return

    try:
        organization_service.send_sso_link_emails(
            organization_id=org_id, sending_user_email=user.email, provider_key=provider_key
        )
    except RegionMappingNotFound:
        logger.warning("Could not send SSO link emails: Missing organization")


@instrumented_task(
    name="sentry.tasks.email_unlink_notifications", queue="auth", silo_mode=SiloMode.REGION
)
def email_unlink_notifications(
    org_id: int, sending_user_email: str, provider_key: str, actor_id: int | None = None
):
    try:
        org = Organization.objects.get(id=org_id)
        provider = manager.get(provider_key)
    except (Organization.DoesNotExist, ProviderNotRegistered) as e:
        logger.warning("Could not send SSO unlink emails: %s", e)
        return

    with unguarded_write(using=router.db_for_write(OrganizationMember)):
        # Flags are not replicated -- these updates are safe to skip outboxes
        OrganizationMember.objects.filter(organization_id=org_id).update(
            flags=F("flags")
            .bitand(~OrganizationMember.flags["sso:linked"])
            .bitand(~OrganizationMember.flags["sso:invalid"])
        )

    # Email all organization users, even if they never linked their accounts.
    # This provides a better experience in the case where SSO is enabled and
    # disabled in the timespan of users checking their email.
    # Results are unordered -- some tests that depend on the mail.outbox ordering may fail
    # intermittently -- force an ordering in your test!
    members = OrganizationMember.objects.filter(organization=org, user_id__isnull=False)
    for member in members:
        member.send_sso_unlink_email(sending_user_email, provider)


class OrganizationComplianceTask(abc.ABC):
    """Remove members who don't comply with a new org requirement."""

    log_label = ""

    @abc.abstractmethod
    def is_compliant(self, user: RpcUser) -> bool:
        """Check whether a member complies with the new requirement."""
        raise NotImplementedError()

    @abc.abstractmethod
    def call_to_action(self, org: Organization, user: RpcUser, member: OrganizationMember) -> None:
        """Prompt a member to comply with the new requirement."""
        raise NotImplementedError()

    def remove_non_compliant_members(
        self, org_id: int, actor_id: int | None, actor_key_id: int | None, ip_address: str | None
    ):
        actor = user_service.get_user(user_id=actor_id) if actor_id else None

        def remove_member(org_member: OrganizationMember, user: RpcUser):
            logging_data = {
                "organization_id": org_id,
                "user_id": user.id,
                "member_id": org_member.id,
            }

            removed_member = organization_service.remove_user(
                organization_id=org_id, user_id=user.id
            )
            if removed_member is None:
                logger.warning(
                    "Could not remove %s noncompliant user from org",
                    self.log_label,
                    extra=logging_data,
                )
            else:
                logger.info(
                    "%s noncompliant user removed from org", self.log_label, extra=logging_data
                )
                create_audit_entry_from_user(
                    user=actor,
                    actor_key_id=actor_key_id,
                    ip_address=ip_address,
                    event=audit_log.get_event_id("MEMBER_PENDING"),
                    data=org_member.get_audit_log_data(),
                    organization_id=org_id,
                    target_object=org_id,
                    target_user_id=user.id,
                )
                # Refresh the org member to ensure we always properly generate an invite link
                org_member.refresh_from_db()
                org = Organization.objects.get_from_cache(id=org_id)
                self.call_to_action(org, user, org_member)

        org_members = OrganizationMember.objects.filter(
            organization_id=org_id, user_id__isnull=False
        )
        rpc_users = user_service.get_many_by_id(
            ids=[member.user_id for member in org_members if member.user_id is not None]
        )
        rpc_users_dict = {user.id: user for user in rpc_users}
        for member in org_members:
            if member.user_id is None:
                continue
            user = rpc_users_dict.get(member.user_id)
            if user is None:
                continue

            if not self.is_compliant(user):
                remove_member(org_member=member, user=user)


class TwoFactorComplianceTask(OrganizationComplianceTask):
    log_label = "2FA"

    def is_compliant(self, user: RpcUser) -> bool:
        if user:
            return user.has_2fa()
        return False

    def call_to_action(self, org: Organization, user: RpcUser, member: OrganizationMember) -> None:
        # send invite to setup 2fa
        email_context = {"url": member.get_invite_link(), "organization": org}
        subject = "{} {} Mandatory: Enable Two-Factor Authentication".format(
            options.get("mail.subject-prefix"), org.name.capitalize()
        )
        message = MessageBuilder(
            subject=subject,
            template="sentry/emails/setup_2fa.txt",
            html_template="sentry/emails/setup_2fa.html",
            type="user.setup_2fa",
            context=email_context,
        )
        message.send_async([member.get_email()])


@instrumented_task(
    name="sentry.tasks.remove_2fa_non_compliant_members",
    queue="auth",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry
def remove_2fa_non_compliant_members(
    org_id: int,
    actor_id: int | None = None,
    actor_key_id: int | None = None,
    ip_address: str | None = None,
) -> None:
    TwoFactorComplianceTask().remove_non_compliant_members(
        org_id, actor_id, actor_key_id, ip_address
    )

from __future__ import annotations

import abc
import logging

from django.db import IntegrityError
from django.db.models import F
from django.urls import reverse

from sentry import audit_log, features, options
from sentry.auth import manager
from sentry.auth.exceptions import ProviderNotRegistered
from sentry.models import ApiKey, AuditLogEntry, Organization, OrganizationMember, User, UserEmail
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.tasks.base import instrumented_task
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.auth")


@instrumented_task(name="sentry.tasks.send_sso_link_emails", queue="auth")
def email_missing_links(org_id: int, actor_id: int, provider_key: str, **kwargs):
    try:
        org = Organization.objects.get(id=org_id)
        provider = manager.get(provider_key)
    except (Organization.DoesNotExist, ProviderNotRegistered) as e:
        logger.warning("Could not send SSO link emails: %s", e)
        return

    user = user_service.get_user(user_id=actor_id)
    if not user:
        logger.warning("sso.link.email_failure.could_not_find_user", extra={"user_id": actor_id})
        return

    member_list = OrganizationMember.objects.filter(
        organization=org, flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"])
    )
    for member in member_list:
        member.send_sso_link_email(user.id, provider)


@instrumented_task(name="sentry.tasks.email_unlink_notifications", queue="auth")
def email_unlink_notifications(org_id: int, actor_id: int, provider_key: str):
    try:
        org = Organization.objects.get(id=org_id)
        provider = manager.get(provider_key)
    except (Organization.DoesNotExist, ProviderNotRegistered) as e:
        logger.warning("Could not send SSO unlink emails: %s", e)
        return

    user = user_service.get_user(user_id=actor_id)
    if not user:
        logger.warning("sso.unlink.email_failure.could_not_find_user", extra={"user_id": actor_id})
        return

    # Email all organization users, even if they never linked their accounts.
    # This provides a better experience in the case where SSO is enabled and
    # disabled in the timespan of users checking their email.
    member_list = OrganizationMember.objects.filter(organization=org)

    for member in member_list:
        member.send_sso_unlink_email(user, provider)


class OrganizationComplianceTask(abc.ABC):
    """Remove members who don't comply with a new org requirement."""

    log_label = ""

    @abc.abstractmethod
    def is_compliant(self, member: OrganizationMember) -> bool:
        """Check whether a member complies with the new requirement."""
        raise NotImplementedError()

    @abc.abstractmethod
    def call_to_action(self, org: Organization, user: User, member: OrganizationMember):
        """Prompt a member to comply with the new requirement."""
        raise NotImplementedError()

    def remove_non_compliant_members(
        self, org_id: int, actor_id: int | None, actor_key_id: int | None, ip_address: str | None
    ):
        actor = User.objects.get(id=actor_id) if actor_id else None
        actor_key = ApiKey.objects.get(id=actor_key_id) if actor_key_id else None

        def remove_member(member):
            user = member.user
            logging_data = {"organization_id": org_id, "user_id": user.id, "member_id": member.id}

            try:
                organization_service.remove_user(organization_id=org_id, user_id=user.id)
            except (AssertionError, IntegrityError):
                logger.warning(
                    f"Could not remove {self.log_label} noncompliant user from org",
                    extra=logging_data,
                )
            else:
                logger.info(
                    f"{self.log_label} noncompliant user removed from org", extra=logging_data
                )
                AuditLogEntry.objects.create(
                    actor=actor,
                    actor_key=actor_key,
                    ip_address=ip_address,
                    event=audit_log.get_event_id("MEMBER_PENDING"),
                    data=member.get_audit_log_data(),
                    organization_id=org_id,
                    target_object=org_id,
                    target_user=user,
                )
                org = Organization.objects.get_from_cache(id=org_id)
                self.call_to_action(org, user, member)

        for member in OrganizationMember.objects.select_related("user").filter(
            organization_id=org_id, user__isnull=False
        ):
            if not self.is_compliant(member):
                remove_member(member)


class TwoFactorComplianceTask(OrganizationComplianceTask):
    log_label = "2FA"

    def is_compliant(self, member: OrganizationMember) -> bool:
        return member.user.has_2fa()

    def call_to_action(self, org: Organization, user: User, member: OrganizationMember):
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
)
def remove_2fa_non_compliant_members(org_id, actor_id=None, actor_key_id=None, ip_address=None):
    TwoFactorComplianceTask().remove_non_compliant_members(
        org_id, actor_id, actor_key_id, ip_address
    )


class VerifiedEmailComplianceTask(OrganizationComplianceTask):
    log_label = "verified email"

    def is_compliant(self, member: OrganizationMember) -> bool:
        # TODO(hybridcloud) this is doing a join from member to user
        return UserEmail.objects.get_primary_email(member.user).is_verified

    def call_to_action(self, org: Organization, user: User, member: OrganizationMember):
        import django.contrib.auth.models

        if isinstance(user, django.contrib.auth.models.User):
            # TODO(RyanSkonnord): Add test to repro this case (or delete check if unable)
            logger.warning(
                "Could not send verified email compliance notification (non-Sentry User model)"
            )
            return
        elif not isinstance(user, User):
            raise TypeError(user)

        # TODO(hybridcloud) This compliance task is using data from both silos.
        email = UserEmail.objects.get_primary_email(user)
        email_context = {
            "confirm_url": absolute_uri(
                reverse("sentry-account-confirm-email", args=[user.id, email.validation_hash])
            ),
            "invite_url": member.get_invite_link(),
            "email": email.email,
            "organization": org,
        }
        subject = "{} {} Mandatory: Verify Email Address".format(
            options.get("mail.subject-prefix"), org.name.capitalize()
        )
        message = MessageBuilder(
            subject=subject,
            template="sentry/emails/setup_email.txt",
            html_template="sentry/emails/setup_email.html",
            type="user.setup_email",
            context=email_context,
        )
        message.send_async([email])


@instrumented_task(
    name="sentry.tasks.remove_email_verification_non_compliant_members",
    queue="auth",
    default_retry_delay=60 * 5,
    max_retries=5,
)
def remove_email_verification_non_compliant_members(
    org_id, actor_id=None, actor_key_id=None, ip_address=None
):
    org = Organization.objects.get_from_cache(id=org_id)
    if features.has("organizations:required-email-verification", org):
        VerifiedEmailComplianceTask().remove_non_compliant_members(
            org_id, actor_id, actor_key_id, ip_address
        )

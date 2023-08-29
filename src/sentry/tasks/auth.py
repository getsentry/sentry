from __future__ import annotations

import abc
import logging
from urllib.parse import urlencode

from django.db.models import F
from django.urls import reverse

from sentry import audit_log, features, options
from sentry.auth import manager
from sentry.auth.exceptions import ProviderNotRegistered
from sentry.models import Organization, OrganizationMember, User, UserEmail
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.services.hybrid_cloud.lost_password_hash import lost_password_hash_service
from sentry.services.hybrid_cloud.organization.model import RpcOrganization
from sentry.services.hybrid_cloud.organization.service import organization_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.utils.audit import create_audit_entry_from_user
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

logger = logging.getLogger("sentry.auth")


# TODO(hybrid-cloud): Remove cross-silo DB accesses, or review control silo usages
# This task is triggered from both control silo (AuthHelper, OrganizationAuthSettingsView)
# and region silo endpoints. Any request to the region endpoint will trap errors.
# My hope is that this task can become control silo only.
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

    # TODO(mark) We don't have member flags available in control silo.
    # This entire method could be moved to an RPC call that is invoked from control silo.
    member_list = OrganizationMember.objects.filter(
        organization=org, flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"])
    )
    for member in member_list:
        member.send_sso_link_email(user.id, provider)


@instrumented_task(
    name="sentry.tasks.email_unlink_notifications", queue="auth.control", silo_mode=SiloMode.CONTROL
)
def email_unlink_notifications(org_id: int, actor_id: int, provider_key: str):
    org = organization_service.get(id=org_id)
    if not org:
        logger.warning("Could not send SSO unlink emails: organization could not be found")
        return

    try:
        provider = manager.get(provider_key)
    except ProviderNotRegistered as e:
        logger.warning("Could not send SSO unlink emails: %s", e)
        return

    user = user_service.get_user(user_id=actor_id)
    if not user:
        logger.warning("sso.unlink.email_failure.could_not_find_user", extra={"user_id": actor_id})
        return

    # Email all organization users, even if they never linked their accounts.
    # This provides a better experience in the case where SSO is enabled and
    # disabled in the timespan of users checking their email.
    member_list = OrganizationMemberMapping.objects.filter(
        organization_id=org_id,
        user_id__isnull=False,
    ).select_related("user")
    for member in member_list:
        _send_sso_unlink_email(member, user, org, provider)


def _send_sso_unlink_email(
    member: OrganizationMemberMapping,
    disabling_user: RpcUser,
    organization: RpcOrganization,
    provider,
):
    # Nothing to send if this member isn't associated to a user
    if not member.user_id:
        return

    user = member.user
    if not user:
        return

    recover_uri = "{path}?{query}".format(
        path=reverse("sentry-account-recover"), query=urlencode({"email": user.email})
    )
    has_password = user.has_usable_password()

    context = {
        "email": user.email,
        "recover_url": absolute_uri(recover_uri),
        "has_password": has_password,
        "organization": organization,
        "disabled_by_email": disabling_user.email,
        "provider": provider,
    }
    if not has_password:
        password_hash = lost_password_hash_service.get_or_create(user_id=user.id)
        context["set_password_url"] = password_hash.get_absolute_url(mode="set_password")

    msg = MessageBuilder(
        subject=f"Action Required for {organization.name}",
        template="sentry/emails/auth-sso-disabled.txt",
        html_template="sentry/emails/auth-sso-disabled.html",
        type="organization.auth_sso_disabled",
        context=context,
    )
    msg.send_async([user.email])


class OrganizationComplianceTask(abc.ABC):
    """Remove members who don't comply with a new org requirement."""

    log_label = ""

    @abc.abstractmethod
    def is_compliant(self, user: RpcUser) -> bool:
        """Check whether a member complies with the new requirement."""
        raise NotImplementedError()

    @abc.abstractmethod
    def call_to_action(self, org: Organization, user: RpcUser, member: OrganizationMember):
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
                    f"Could not remove {self.log_label} noncompliant user from org",
                    extra=logging_data,
                )
            else:
                logger.info(
                    f"{self.log_label} noncompliant user removed from org", extra=logging_data
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
        rpc_users = user_service.get_many(
            filter=dict(user_ids=[member.user_id for member in org_members])
        )
        rpc_users_dict = {user.id: user for user in rpc_users}
        for member in org_members:
            user = rpc_users_dict.get(member.user_id, None)
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

    def call_to_action(self, org: Organization, user: RpcUser, member: OrganizationMember):
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
def remove_2fa_non_compliant_members(org_id, actor_id=None, actor_key_id=None, ip_address=None):
    TwoFactorComplianceTask().remove_non_compliant_members(
        org_id, actor_id, actor_key_id, ip_address
    )


class VerifiedEmailComplianceTask(OrganizationComplianceTask):
    log_label = "verified email"

    def is_compliant(self, user: RpcUser) -> bool:
        if user:
            return UserEmail.objects.get_primary_email(user).is_verified
        return False

    def call_to_action(self, org: Organization, user: RpcUser, member: OrganizationMember):
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
    silo_mode=SiloMode.REGION,
)
@retry
def remove_email_verification_non_compliant_members(
    org_id, actor_id=None, actor_key_id=None, ip_address=None
):
    org = Organization.objects.get_from_cache(id=org_id)
    if features.has("organizations:required-email-verification", org):
        VerifiedEmailComplianceTask().remove_non_compliant_members(
            org_id, actor_id, actor_key_id, ip_address
        )

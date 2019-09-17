from __future__ import absolute_import, print_function

import logging

from django.db import IntegrityError
from django.db.models import F

from sentry import options
from sentry.models import (
    ApiKey,
    AuditLogEntryEvent,
    AuditLogEntry,
    Authenticator,
    Organization,
    OrganizationMember,
    User,
)
from sentry.tasks.base import instrumented_task
from sentry.auth import manager
from sentry.auth.exceptions import ProviderNotRegistered
from sentry.utils.email import MessageBuilder

logger = logging.getLogger("sentry.auth")


@instrumented_task(name="sentry.tasks.send_sso_link_emails", queue="auth")
def email_missing_links(org_id, actor_id, provider_key, **kwargs):
    try:
        org = Organization.objects.get(id=org_id)
        actor = User.objects.get(id=actor_id)
        provider = manager.get(provider_key)
    except (Organization.DoesNotExist, User.DoesNotExist, ProviderNotRegistered) as e:
        logger.warning("Could not send SSO link emails: %s", e)
        return

    member_list = OrganizationMember.objects.filter(
        organization=org, flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"])
    )
    for member in member_list:
        member.send_sso_link_email(actor, provider)


@instrumented_task(name="sentry.tasks.email_unlink_notifications", queue="auth")
def email_unlink_notifications(org_id, actor_id, provider_key):
    try:
        org = Organization.objects.get(id=org_id)
        actor = User.objects.get(id=actor_id)
        provider = manager.get(provider_key)
    except (Organization.DoesNotExist, User.DoesNotExist, ProviderNotRegistered) as e:
        logger.warning("Could not send SSO unlink emails: %s", e)
        return

    # Email all organization users, even if they never linked their accounts.
    # This provides a better experience in the case where SSO is enabled and
    # disabled in the timespan of users checking their email.
    member_list = OrganizationMember.objects.filter(organization=org).select_related("user")

    for member in member_list:
        member.send_sso_unlink_email(actor, provider)


@instrumented_task(
    name="sentry.tasks.remove_2fa_non_compliant_members",
    queue="auth",
    default_retry_delay=60 * 5,
    max_retries=5,
)
def remove_2fa_non_compliant_members(org_id, actor_id=None, actor_key_id=None, ip_address=None):
    org = Organization.objects.get(id=org_id)
    actor = User.objects.get(id=actor_id) if actor_id else None
    actor_key = ApiKey.objects.get(id=actor_key_id) if actor_key_id else None

    for member in OrganizationMember.objects.select_related("user").filter(
        organization=org, user__isnull=False
    ):
        if not Authenticator.objects.user_has_2fa(member.user):
            _remove_2fa_non_compliant_member(
                member, org, actor=actor, actor_key=actor_key, ip_address=ip_address
            )


def _remove_2fa_non_compliant_member(member, org, actor=None, actor_key=None, ip_address=None):
    user = member.user
    logging_data = {"organization_id": org.id, "user_id": user.id, "member_id": member.id}

    try:
        member.remove_user()
        member.save()
    except (AssertionError, IntegrityError):
        logger.warning("Could not remove 2FA noncompliant user from org", extra=logging_data)
    else:
        logger.info("2FA noncompliant user removed from org", extra=logging_data)
        AuditLogEntry.objects.create(
            actor=actor,
            actor_key=actor_key,
            ip_address=ip_address,
            event=AuditLogEntryEvent.MEMBER_PENDING,
            data=member.get_audit_log_data(),
            organization=org,
            target_object=org.id,
            target_user=user,
        )

        # send invite to setup 2fa
        email_context = {"url": member.get_invite_link(), "organization": org}
        subject = u"{} {} Mandatory: Enable Two-Factor Authentication".format(
            options.get("mail.subject-prefix"), org.name.capitalize()
        )
        message = MessageBuilder(
            subject=subject,
            template="sentry/emails/setup_2fa.txt",
            html_template="sentry/emails/setup_2fa.html",
            type="user.setup_2fa",
            context=email_context,
        )
        message.send_async([member.email])

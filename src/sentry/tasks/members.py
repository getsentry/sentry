from django.urls import reverse
from structlog import get_logger

from sentry import analytics, roles
from sentry.models import InviteStatus, OrganizationMember
from sentry.tasks.base import instrumented_task
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri


@instrumented_task(name="sentry.tasks.send_invite_request_notification_email", queue="email")
def send_invite_request_notification_email(member_id):
    try:
        om = OrganizationMember.objects.select_related("inviter", "organization").get(id=member_id)
    except OrganizationMember.DoesNotExist:
        return

    link_args = {"organization_slug": om.organization.slug}

    context = {
        "email": om.email,
        "organization_name": om.organization.name,
        "pending_requests_link": absolute_uri(
            reverse("sentry-organization-members", kwargs=link_args)
        ),
    }

    if om.requested_to_join:
        email_args = {
            "template": "sentry/emails/organization-join-request.txt",
            "html_template": "sentry/emails/organization-join-request.html",
        }
        context["settings_link"] = absolute_uri(
            reverse("sentry-organization-settings", args=[om.organization.slug])
        )

    elif om.requested_to_be_invited:
        email_args = {
            "template": "sentry/emails/organization-invite-request.txt",
            "html_template": "sentry/emails/organization-invite-request.html",
        }
        context["inviter_name"] = om.inviter.get_salutation_name
    else:
        raise RuntimeError("This member is not pending invitation")

    recipients = OrganizationMember.objects.select_related("user").filter(
        organization_id=om.organization_id,
        user__isnull=False,
        invite_status=InviteStatus.APPROVED.value,
        role__in=(r.id for r in roles.get_all() if r.has_scope("member:write")),
    )

    msg = MessageBuilder(
        subject=f"Access request to {om.organization.name}",
        type="organization.invite-request",
        context=context,
        **email_args,
    )

    for recipient in recipients:
        try:
            msg.send_async([recipient.get_email()])
        except Exception as e:
            logger = get_logger(name="sentry.mail")
            logger.exception(e)
        analytics.record(
            "invite_request.sent",
            organization_id=om.organization.id,
            user_id=om.inviter.id if om.inviter else None,
            target_user_id=recipient.id,
            providers="email",
        )

from __future__ import annotations

from django.db.models import F

from sentry import features
from sentry.models import Organization, OrganizationMember
from sentry.tasks.base import instrumented_task
from sentry.tasks.reports import deliver_organization_user_report
from sentry.tasks.reports.utils.util import _get_organization_queryset


@instrumented_task(
    name="sentry.tasks.reports.prepare_organization_report",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
)
def prepare_organization_report(
    timestamp: float,
    duration: float,
    organization_id: int,
    user_id: int | None = None,
    dry_run: bool = False,
) -> None:
    from sentry.tasks.reports import backend, logger

    try:
        organization = _get_organization_queryset().get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "reports.organization.missing",
            extra={
                "timestamp": timestamp,
                "duration": duration,
                "organization_id": organization_id,
            },
        )
        return

    if features.has("organizations:weekly-report-debugging", organization):
        logger.info(
            "reports.org.begin_computing_report",
            extra={
                "organization_id": organization.id,
            },
        )

    backend.prepare(timestamp, duration, organization)

    # If an OrganizationMember row doesn't have an associated user, this is
    # actually a pending invitation, so no report should be delivered.
    kwargs = dict(user_id__isnull=False, user__is_active=True)
    if user_id:
        kwargs["user_id"] = user_id

    member_set = organization.member_set.filter(**kwargs).exclude(
        flags=F("flags").bitor(OrganizationMember.flags["member-limit:restricted"])
    )

    for user_id in member_set.values_list("user_id", flat=True):
        deliver_organization_user_report.delay(
            timestamp, duration, organization_id, user_id, dry_run=dry_run
        )

import logging
from datetime import timedelta

from django.utils import timezone

from sentry.cache import default_cache
from sentry.models import Organization, OrganizationStatus
from sentry.tasks.base import instrumented_task
from sentry.tasks.reports import prepare_organization_report
from sentry.tasks.reports.utils.constants import ONE_DAY
from sentry.tasks.reports.utils.util import prepare_reports_verify_key
from sentry.utils.dates import floor_to_utc_day, to_timestamp
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)
STEP_SIZE = 10000


def _fill_default_parameters(timestamp=None, rollup=None):
    if timestamp is None:
        timestamp = to_timestamp(floor_to_utc_day(timezone.now()))

    if rollup is None:
        rollup = ONE_DAY * 7

    return timestamp, rollup


@instrumented_task(
    name="sentry.tasks.reports.prepare_reports",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
)
def prepare_reports(dry_run=False, *args, **kwargs):
    timestamp, duration = _fill_default_parameters(*args, **kwargs)

    logger.info("reports.begin_prepare_report")

    organizations = Organization.objects.filter(status=OrganizationStatus.VISIBLE).values_list(
        "id", flat=True
    )

    for i, organization_id in enumerate(
        RangeQuerySetWrapper(organizations, step=STEP_SIZE, result_value_getter=lambda item: item)
    ):
        prepare_organization_report.delay(timestamp, duration, organization_id, dry_run=dry_run)
        if i % STEP_SIZE == 0:
            logger.info(
                "reports.scheduled_prepare_organization_report",
                extra={"organization_id": organization_id, "total_scheduled": i},
            )

    default_cache.set(prepare_reports_verify_key(), "1", int(timedelta(days=3).total_seconds()))
    logger.info("reports.finish_prepare_report")

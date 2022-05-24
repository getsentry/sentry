from sentry.cache import default_cache
from sentry.tasks.base import instrumented_task
from sentry.tasks.reports.utils.util import prepare_reports_verify_key

VERIFY_ERROR_MESSAGE = (
    "Failed to verify that sentry.tasks.reports.prepare_reports successfully"
    " completed. Confirm whether this worked via logs"
)


@instrumented_task(
    name="sentry.tasks.reports.verify_prepare_reports",
    queue="reports.prepare",
    max_retries=5,
    acks_late=True,
)
def verify_prepare_reports(*args, **kwargs):
    from sentry.tasks.reports import logger

    logger.info("reports.begin_verify_prepare_reports")
    verify = default_cache.get(prepare_reports_verify_key())
    if verify is None:
        logger.error(VERIFY_ERROR_MESSAGE)
    logger.info("reports.end_verify_prepare_reports")

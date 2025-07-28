import logging
from urllib.parse import urlparse

from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import uptime_tasks
from sentry.taskworker.retry import Retry
from sentry.uptime.models import UptimeSubscription
from sentry.uptime.rdap.query import resolve_rdap_network_details

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.uptime.rdap.tasks.fetch_subscription_rdap_info",
    queue="uptime",
    autoretry_for=(Exception,),
    max_retries=5,
    taskworker_config=TaskworkerConfig(
        namespace=uptime_tasks,
        retry=Retry(
            times=5,
            on=(Exception,),
        ),
        processing_deadline_duration=30,
    ),
)
def fetch_subscription_rdap_info(subscription_id: int):
    """
    Fetches the RDAP network details for a subscriptions host and populates the
    host_provider fields in the subscription.
    """
    try:
        sub = UptimeSubscription.objects.get(id=subscription_id)
    except UptimeSubscription.DoesNotExist:
        # Nothing to do if this subscription was removed before we could fetch
        # the rdap details.
        return

    parsed_url = urlparse(sub.url)

    if parsed_url.hostname is None:
        logger.warning("rdap_url_missing_hostname", extra={"url": sub.url})
        return

    details = resolve_rdap_network_details(parsed_url.hostname)
    if details is None:
        logger.info("rdap_resolve_network_details_failure", extra={"url": sub.url})
        return

    sub.update(host_provider_id=details["handle"], host_provider_name=details["owner_name"])

from sentry import options
from sentry.killswitches import killswitch_matches_context
from sentry.profiles.task import process_profile_task

# Headers from taskbroker passthrough are dict[str, str]
Headers = dict[str, str]


def process_profile_message(
    message_bytes: bytes,
    headers: Headers,
    inline: bool = False,
) -> None:
    """Process a profile message from Kafka (taskbroker passthrough)."""
    if should_drop(headers):
        return

    sampled = is_sampled(headers)

    if not sampled and not options.get("profiling.profile_metrics.unsampled_profiles.enabled"):
        return

    if inline:
        process_profile_task(payload=message_bytes, sampled=sampled)
    else:
        process_profile_task.delay(payload=message_bytes, sampled=sampled)


def is_sampled(headers: Headers) -> bool:
    return headers.get("sampled", "true") == "true"


def should_drop(headers: Headers) -> bool:
    context = {"project_id": headers["project_id"]} if "project_id" in headers else {}

    if "project_id" in context and killswitch_matches_context(
        "profiling.killswitch.ingest-profiles", context
    ):
        return True

    return False

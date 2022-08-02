import logging
from typing import Mapping, Optional

from sentry.tasks.post_process import post_process_group
from sentry.utils.cache import cache_key_for_event
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

# Beware! Changing this protocol (introducing a new version, or the message
# format/fields themselves) requires consideration of all downstream
# consumers. This includes the post-processing forwarder code!
EVENT_PROTOCOL_VERSION = 2

# These keys correspond to tags that are typically prefixed with `sentry:`
# and will wreak havok in the UI if both the `sentry:`-prefixed and
# non-prefixed variations occur in a response.
UNEXPECTED_TAG_KEYS = frozenset(["dist", "release", "user"])


def dispatch_post_process_group_task(
    event_id: str,
    project_id: int,
    group_id: Optional[int],
    is_new: bool,
    is_regression: bool,
    is_new_group_environment: bool,
    primary_hash: Optional[str],
    skip_consume: bool = False,
) -> None:
    """
    Dispatch the post process group task. Event could be an error or transaction.
    TODO(meredith): have a separate task for transactions.
    """
    if skip_consume:
        logger.info("post_process.skip.raw_event", extra={"event_id": event_id})
    else:
        cache_key = cache_key_for_event({"project": project_id, "event_id": event_id})

        post_process_group.delay(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            primary_hash=primary_hash,
            cache_key=cache_key,
            group_id=group_id,
        )


# HACK: We are putting all this extra information that is required by the
# post process forwarder into the headers so we can skip parsing entire json
# messages. The post process forwarder is currently bound to a single core.
# Once we are able to parallelize the JSON parsing and other transformation
# steps being done there we may want to remove this hack.
def encode_bool(value: Optional[bool]) -> str:
    if value is None:
        value = False
    return str(int(value))


def strip_none_values(
    headers: Mapping[str, Optional[str]],
) -> Mapping[str, str]:

    return {key: value for key, value in headers.items() if value is not None}


def get_unexpected_tags(event_data):
    return {
        k
        for (k, v) in (get_path(event_data, "tags", filter=True) or [])
        if k in UNEXPECTED_TAG_KEYS
    }

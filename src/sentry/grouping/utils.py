from __future__ import annotations

from collections.abc import Iterable
from hashlib import md5
from itertools import islice
from typing import TYPE_CHECKING
from uuid import UUID

from django.utils.encoding import force_bytes

from sentry.grouping.parameterization import Parameterizer
from sentry.options.rollout import in_rollout_group
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.grouping.component import ExceptionGroupingComponent
    from sentry.services.eventstore.models import Event


def hash_from_values(values: Iterable[str | int | UUID | ExceptionGroupingComponent]) -> str:
    """
    Primarily used at the end of the grouping process, to get a final hash value once the all of the
    variants have been constructed, but also used as a hack to compare exception components (by
    stringifying their reprs) when calculating variants for chained exceptions.
    """
    result = md5()
    for value in values:
        result.update(force_bytes(value, errors="replace"))
    return result.hexdigest()


def bool_from_string(value: str) -> bool | None:
    """
    Convert various string representations of boolean values ("1", "yes", "true", "0", "no",
    "false") into actual booleans. Return `None` for all other inputs.
    """
    if value:
        value = value.lower()
        if value in ("1", "yes", "true"):
            return True
        elif value in ("0", "no", "false"):
            return False

    return None


# TODO: We should strip whitespace no matter what, whether or not we're trimming. Right now we don't
# do so in either case. (The `.strip()` used during trimming filters out empty lines, but doesn't
# actually strip non-empty ones.) This will require a new grouping config, since unstripped and
# stripped messages won't group together.
#
# TODO: Both here during trimming and in the message strategy (where we check if the message has
# been changed), we assume the kind of change which has happened. Here we add "...", and there we
# say we "stripped event-specific values," even if all we've done in either case is remove empty
# lines.
@metrics.wraps("grouping.normalize_message_for_grouping")
def normalize_message_for_grouping(
    message: str, event: Event, *, source: str, trim_message: bool
) -> str:
    """
    Replace values from a event's message with placeholders (in order to improve grouping). If
    `trim_message` is True, trim the message to at most 2 lines.
    """
    parameterizer = Parameterizer(
        experimental=in_rollout_group("grouping.experimental_parameterization", event.project_id),
    )

    if trim_message:
        # If there are multiple lines, grab the first two non-empty ones
        trimmed = "\n".join(
            islice(
                (x for x in message.splitlines() if x.strip()),
                2,
            )
        )
        if trimmed != message:
            trimmed += "..."

        normalized = parameterizer.parameterize_all(trimmed)
    else:
        normalized = parameterizer.parameterize_all(message)

    parameterization_counts = parameterizer.matches_counter.items()
    if parameterization_counts:
        metrics.incr("grouping.message_parameterized", tags={"source": source})

        for key, value in parameterization_counts:
            # `key` can only be one of the keys from `_parameterization_regex`, thus, not a large
            # cardinality. Tracking the key helps distinguish what kinds of replacements are happening.
            metrics.incr("grouping.value_trimmed_from_message", amount=value, tags={"key": key})

    return normalized

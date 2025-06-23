from __future__ import annotations

from itertools import islice
from typing import TYPE_CHECKING, Any

from sentry import analytics
from sentry.grouping.component import MessageGroupingComponent
from sentry.grouping.parameterization import Parameterizer, UniqueIdExperiment
from sentry.grouping.strategies.base import (
    GroupingContext,
    ReturnedVariants,
    produces_variants,
    strategy,
)
from sentry.interfaces.message import Message
from sentry.options.rollout import in_rollout_group
from sentry.utils import metrics
from sentry.utils.settings import is_self_hosted

if TYPE_CHECKING:
    from sentry.eventstore.models import Event

REGEX_PATTERN_KEYS = (
    "email",
    "url",
    "hostname",
    "ip",
    "traceparent",
    "uuid",
    "sha1",
    "md5",
    "date",
    "duration",
    "hex",
    "float",
    "int",
    "quoted_str",
    "bool",
)

EXPERIMENT_PROJECTS = [  # Active internal Sentry projects
    1,
    11276,
    54785,
    155735,
    162676,
    221969,
    300688,
    1267915,
    1269704,
    1492057,
    6424467,
    6690737,
    4503972821204992,
    4505469596663808,
    4506400311934976,
]


@metrics.wraps("grouping.normalize_message_for_grouping")
def normalize_message_for_grouping(message: str, event: Event, share_analytics: bool = True) -> str:
    """Replace values from a group's message with placeholders (to hide P.I.I. and
    improve grouping when no stacktrace is available) and trim to at most 2 lines.
    """
    trimmed = "\n".join(
        # If there are multiple lines, grab the first two non-empty ones.
        islice(
            (x for x in message.splitlines() if x.strip()),
            2,
        )
    )
    if trimmed != message:
        trimmed += "..."

    def _should_run_experiment(experiment_name: str) -> bool:
        return bool(
            not is_self_hosted()
            and event.project_id
            and (
                in_rollout_group(
                    f"grouping.experiments.parameterization.{experiment_name}", event.project_id
                )
                or event.project_id in EXPERIMENT_PROJECTS
            )
        )

    parameterizer = Parameterizer(
        regex_pattern_keys=REGEX_PATTERN_KEYS,
        experiments=(UniqueIdExperiment,),
    )

    normalized = parameterizer.parameterize_all(trimmed, _should_run_experiment)

    for experiment in parameterizer.get_successful_experiments():
        if share_analytics and experiment.counter < 100:
            experiment.counter += 1
            analytics.record(
                "grouping.experiments.parameterization",
                experiment_name=experiment.name,
                project_id=event.project_id,
                event_id=event.event_id,
            )

    for key, value in parameterizer.matches_counter.items():
        # `key` can only be one of the keys from `_parameterization_regex`, thus, not a large
        # cardinality. Tracking the key helps distinguish what kinds of replacements are happening.
        metrics.incr("grouping.value_trimmed_from_message", amount=value, tags={"key": key})

    return normalized


@strategy(ids=["message:v1"], interface=Message, score=0)
@produces_variants(["default"])
def message_v1(
    interface: Message, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    if context["normalize_message"]:
        raw = interface.message or interface.formatted or ""
        normalized = normalize_message_for_grouping(raw, event)
        hint = "stripped event-specific values" if raw != normalized else None
        return {context["variant"]: MessageGroupingComponent(values=[normalized], hint=hint)}
    else:
        return {
            context["variant"]: MessageGroupingComponent(
                values=[interface.message or interface.formatted or ""],
            )
        }

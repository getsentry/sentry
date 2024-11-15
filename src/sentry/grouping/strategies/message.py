from itertools import islice
from typing import Any

from sentry import analytics
from sentry.eventstore.models import Event
from sentry.features.rollout import in_rollout_group
from sentry.grouping.component import BaseGroupingComponent
from sentry.grouping.parameterization import Parameterizer, UniqueIdExperiment
from sentry.grouping.strategies.base import (
    GroupingContext,
    ReturnedVariants,
    produces_variants,
    strategy,
)
from sentry.interfaces.message import Message
from sentry.utils import metrics


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

    parameterizer = Parameterizer(
        regex_pattern_keys=(
            "email",
            "url",
            "hostname",
            "ip",
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
        ),
        experiments=(UniqueIdExperiment,),
    )

    def _shoudl_run_experiment(experiment_name: str) -> bool:
        return bool(
            event.project_id
            and (
                in_rollout_group(
                    f"grouping.experiments.parameterization.{experiment_name}", event.project_id
                )
                or event.project_id
                in [  # Active internal Sentry projects
                    155735,
                    4503972821204992,
                    1267915,
                    221969,
                    11276,
                    1269704,
                    4505469596663808,
                    1,
                    54785,
                    1492057,
                    162676,
                    6690737,
                    300688,
                    4506400311934976,
                    6424467,
                ]
            )
        )

    normalized = parameterizer.parameterize_all(trimmed, _shoudl_run_experiment)

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
        return {
            context["variant"]: BaseGroupingComponent(
                id="message",
                values=[normalized],
                hint=hint,
            )
        }
    else:
        return {
            context["variant"]: BaseGroupingComponent(
                id="message",
                values=[interface.message or interface.formatted or ""],
            )
        }

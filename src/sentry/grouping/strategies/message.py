import dataclasses
from collections import defaultdict
from collections.abc import Callable
from functools import lru_cache
from itertools import islice
from re import Match
from typing import Any

import tiktoken

from sentry import analytics
from sentry.eventstore.models import Event
from sentry.features.rollout import in_rollout_group
from sentry.grouping.component import GroupingComponent
from sentry.grouping.parametrization import make_regex_from_patterns
from sentry.grouping.strategies.base import (
    GroupingContext,
    ReturnedVariants,
    produces_variants,
    strategy,
)
from sentry.interfaces.message import Message
from sentry.utils import metrics

_parametrization_pattern_keys = (
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
)


_parameterization_regex = make_regex_from_patterns(_parametrization_pattern_keys)


# UniqID logic
@lru_cache(maxsize=1)
def tiktoken_encoding():
    return tiktoken.get_encoding("cl100k_base")


def num_tokens_from_string(token_str: str) -> int:
    """Returns the number of tokens in a text string."""
    num_tokens = len(tiktoken_encoding().encode(token_str))
    return num_tokens


# These are all somewhat arbitrary based on examples.
UNIQ_ID_TOKEN_LENGTH_MINIMUM = (
    4  # Tokens smaller than this are unlikely to be unique ids regardless of other attributes
)
UNIQ_ID_TOKEN_LENGTH_RATIO_DEFAULT = 0.5
UNIQ_ID_TOKEN_LENGTH_LONG = 10
UNIQ_ID_TOKEN_LENGTH_RATIO_LONG = 0.4


def is_probably_uniq_id(token_str: str) -> bool:
    token_str = token_str.strip("\"'[]{}():;")
    if len(token_str) < UNIQ_ID_TOKEN_LENGTH_MINIMUM:
        return False
    if token_str[0] == "<" and token_str[-1] == ">":  # Don't replace already-parameterized tokens
        return False
    token_length_ratio = num_tokens_from_string(token_str) / len(token_str)
    if (
        len(token_str) > UNIQ_ID_TOKEN_LENGTH_LONG
        and token_length_ratio > UNIQ_ID_TOKEN_LENGTH_RATIO_LONG
    ):
        return True
    return token_length_ratio > UNIQ_ID_TOKEN_LENGTH_RATIO_DEFAULT


def replace_uniq_ids_in_str(string: str) -> tuple[str, int]:
    """
    Return result and count of replacements
    """
    strings = string.split(" ")
    count = 0
    for i, s in enumerate(strings):
        if is_probably_uniq_id(s):
            strings[i] = "<uniq_id>"
            count += 1
    return (" ".join(strings), count)


def parameterization_experiment_default_run(
    self: "ParameterizationExperiment", _handle_regex_match: Callable[[Match[str]], str], input: str
) -> tuple[str, int]:
    return (self.regex.sub(_handle_regex_match, input), 0)


def parameterization_experiment_uniq_id(
    self: "ParameterizationExperiment", _: Callable[[Match[str]], str], input: str
) -> tuple[str, int]:
    return replace_uniq_ids_in_str(input)


@dataclasses.dataclass()
class ParameterizationExperiment:
    name: str
    regex: Any
    """A function that takes as arguments:
            * This experiment
            * A handle match function (may not be used), e.g. _handle_regex_match (note that this modifies trimmed_value_counter)
            * A string input
        And returns: a tuple of [output string, count of replacements(which overlaps with any added by _handle_regex_match, if used)]
    """
    run: Callable[
        ["ParameterizationExperiment", Callable[[Match[str]], str], str], tuple[str, int]
    ] = parameterization_experiment_default_run
    counter: int = 0


# Note that experiments are run AFTER the initial replacements. Which means they MUST not catch replacements made
# in the primary parameterization regex.
_parameterization_regex_experiments = [
    ParameterizationExperiment(name="uniq_id", regex=None, run=parameterization_experiment_uniq_id),
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

    trimmed_value_counter: defaultdict[str, int] = defaultdict(int)

    def _handle_regex_match(match: Match[str]) -> str:
        # Find the first (should be only) non-None match entry, and sub in the placeholder. For
        # example, given the groupdict item `('hex', '0x40000015')`, this returns '<hex>' as a
        # replacement for the original value in the string.
        for key, value in match.groupdict().items():
            if value is not None:
                trimmed_value_counter[key] += 1
                return f"<{key}>"
        return ""

    normalized = _parameterization_regex.sub(_handle_regex_match, trimmed)
    for experiment in _parameterization_regex_experiments:
        if event.project_id and (
            in_rollout_group(
                f"grouping.experiments.parameterization.{experiment.name}", event.project_id
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
        ):
            experiment_output, metric_inc = experiment.run(
                experiment, _handle_regex_match, normalized
            )
            if experiment_output != normalized:
                trimmed_value_counter[experiment.name] += metric_inc
                # Register 100 (arbitrary, bounded number) analytics events per experiment per instance restart
                # This generates samples for review consistently but creates a hard cap on
                # analytics event volume
                if share_analytics and experiment.counter < 100:
                    experiment.counter += 1
                    analytics.record(
                        "grouping.experiments.parameterization",
                        experiment_name=experiment.name,
                        project_id=event.project_id,
                        event_id=event.event_id,
                    )
                normalized = experiment_output

    for key, value in trimmed_value_counter.items():
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
            context["variant"]: GroupingComponent(
                id="message",
                values=[normalized],
                hint=hint,
            )
        }
    else:
        return {
            context["variant"]: GroupingComponent(
                id="message",
                values=[interface.message or interface.formatted or ""],
            )
        }

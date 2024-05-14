import dataclasses
import re
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
from sentry.grouping.strategies.base import (
    GroupingContext,
    ReturnedVariants,
    produces_variants,
    strategy,
)
from sentry.interfaces.message import Message
from sentry.utils import metrics

# The `(?x)` tells the regex compiler to ignore comments and unescaped whitespace,
# so we can use newlines and indentation for better legibility.
_parameterization_regex_str = r"""(?x)
    (?P<email>
        [a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*
    ) |
    (?P<url>
        \b(wss?|https?|ftp)://[^\s/$.?#].[^\s]*
    ) |
    (?P<hostname> # Top 100 TLDs. The complete list is 1000s long.
        \b
        ([a-zA-Z0-9\-]{1,63}\.)+?
        (
            (COM|NET|ORG|JP|DE|UK|FR|BR|IT|RU|ES|ME|GOV|PL|CA|AU|CN|CO|IN|NL|EDU|INFO|EU|CH|ID|AT|KR|CZ|MX|BE|TV|SE|TR|TW|AL|UA|IR|VN|CL|SK|LY|CC|TO|NO|FI|US|PT|DK|AR|HU|TK|GR|IL|NEWS|RO|MY|BIZ|IE|ZA|NZ|SG|EE|TH|IO|XYZ|PE|BG|HK|RS|LT|LINK|PH|CLUB|SI|SITE|MOBI|BY|CAT|WIKI|LA|GA|XXX|CF|HR|NG|JOBS|ONLINE|KZ|UG|GQ|AE|IS|LV|PRO|FM|TIPS|MS|SA|APP)|
            (com|net|org|jp|de|uk|fr|br|it|ru|es|me|gov|pl|ca|au|cn|co|in|nl|edu|info|eu|ch|id|at|kr|cz|mx|be|tv|se|tr|tw|al|ua|ir|vn|cl|sk|ly|cc|to|no|fi|us|pt|dk|ar|hu|tk|gr|il|news|ro|my|biz|ie|za|nz|sg|ee|th|io|xyz|pe|bg|hk|rs|lt|link|ph|club|si|site|mobi|by|cat|wiki|la|ga|xxx|cf|hr|ng|jobs|online|kz|ug|gq|ae|is|lv|pro|fm|tips|ms|sa|app)
        )
        \b
    ) |
    (?P<ip>
        (
            ([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|
            ([0-9a-fA-F]{1,4}:){1,7}:|
            ([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|
            ([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|
            ([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|
            ([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|
            ([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|
            [0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|
            :((:[0-9a-fA-F]{1,4}){1,7}|:)|
            fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|
            ::(ffff(:0{1,4}){0,1}:){0,1}
            ((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
            (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|
            ([0-9a-fA-F]{1,4}:){1,4}:
            ((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
            (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\b
        ) |
        (
            \b((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
            (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\b
        )
    ) |
    (?P<uuid>
        \b
            [0-9a-fA-F]{8}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{12}
        \b
    ) |
    (?P<sha1>
        \b[0-9a-fA-F]{40}\b
    ) |
    (?P<md5>
        \b[0-9a-fA-F]{32}\b
    ) |
    (?P<date>
        # No word boundaries required around dates. Should there be?
        # RFC822, RFC1123, RFC1123Z
        ((?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2,4}\s\d{1,2}:\d{1,2}(:\d{1,2})?\s([-\+][\d]{2}[0-5][\d]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z])))
        |
        # Similar to RFC822, but "Mon Jan 02, 1999", "Jan 02, 1999"
        (((?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s[0-3]\d,\s\d{2,4})
        |
        # RFC850
        ((?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}\s\d{2}:\d{2}:\d{2}\s(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))
        |
        # RFC3339, RFC3339Nano
        (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?([+-]?\d{2}:\d{2})?)
        |
        # Datetime:
        (\d{4}-?[01]\d-?[0-3]\d\s[0-2]\d:[0-5]\d:[0-5]\d)(\.\d+)?
        |
        # Kitchen
        (\d{1,2}:\d{2}(:\d{2})?(?: [aApP][Mm])?)
        |
        # Date
        (\d{4}-[01]\d-[0-3]\d)
        |
        # Time
        ([0-2]\d:[0-5]\d:[0-5]\d)
        |
        # Old Date Formats, TODO: possibly safe to remove?
        (
            (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|
            (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|
            (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))
        ) |
        (
            \b(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+)?
            (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+
            ([\d]{1,2})\s+
            ([\d]{2}:[\d]{2}:[\d]{2})\s+
            [\d]{4}
        ) |
        (
            \b(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?
            (0[1-9]|[1-2]?[\d]|3[01])\s+
            (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+
            (19[\d]{2}|[2-9][\d]{3})\s+
            (2[0-3]|[0-1][\d]):([0-5][\d])
            (?::(60|[0-5][\d]))?\s+
            ([-\+][\d]{2}[0-5][\d]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))
        ) |
        (datetime.datetime\(.*?\))
    ) |
    (?P<duration>
        \b
        (\d+ms) |
        (\d(\.\d+)?s)
        \b
    ) |
    (?P<hex>
        \b0[xX][0-9a-fA-F]+\b
    ) |
    (?P<float>
        -\d+\.\d+\b |
        \b\d+\.\d+\b
    ) |
    (?P<int>
        -\d+\b |
        \b\d+\b
    ) |
    (?P<quoted_str>
        # The `=` here guarantees we'll only match the value half of key-value pairs,
        # rather than all quoted strings
        ='([^']+)' |
        ="([^"]+)"
    ) |
    (?P<bool>
        # The `=` here guarantees we'll only match the value half of key-value pairs,
        # rather than all instances of the words 'true' and 'false'.
        =True |
        =true |
        =False |
        =false
    )
"""

_parameterization_regex = re.compile(_parameterization_regex_str)


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
                # For `quoted_str` and `bool` we want to preserve the `=` symbol, which we include in
                # the match in order not to replace random quoted strings and the words 'true' and 'false'
                # in contexts other than key-value pairs
                if key in ["quoted_str", "bool"]:
                    return f"=<{key}>"
                else:
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

import re
from itertools import islice
from typing import Any, Match

from sentry.eventstore.models import Event
from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import (
    GroupingContext,
    ReturnedVariants,
    produces_variants,
    strategy,
)
from sentry.grouping.strategies.similarity_encoders import text_shingle_encoder
from sentry.interfaces.message import Message
from sentry.utils import metrics

_irrelevant_re = re.compile(
    r"""(?x)
    (?P<email>
        [a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*
    ) |
    (?P<url>
        \b(wss?|https?|ftp)://[^\s/$.?#].[^\s]*
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
        ='([\w\s]+)'
    )
"""
)


def trim_message_for_grouping(string: str) -> str:
    """Replace values from a group's message to hide P.I.I. and improve grouping when no
    stacktrace available.
    """
    s = "\n".join(islice((x for x in string.splitlines() if x.strip()), 2)).strip()
    if s != string:
        s += "..."

    def _handle_match(match: Match[str]) -> str:
        # e.g. hex, 0x40000015
        for key, value in match.groupdict().items():
            if value is not None:
                # key can be one of the keys from _irrelevant_re, thus, not a large cardinality
                # tracking the key helps distinguish what kinds of replacements are happening
                metrics.incr("grouping.value_trimmed_from_message", tags={"key": key})
                # For quoted_str we want to preserver the = symbol
                return f"=<{key}>" if key == "quoted_str" else f"<{key}>"
        return ""

    return _irrelevant_re.sub(_handle_match, s)


@strategy(ids=["message:v1"], interface=Message, score=0)
@produces_variants(["default"])
def message_v1(
    interface: Message, event: Event, context: GroupingContext, **meta: Any
) -> ReturnedVariants:
    if context["trim_message"]:
        message_in = interface.message or interface.formatted or ""
        message_trimmed = trim_message_for_grouping(message_in)
        hint = "stripped common values" if message_in != message_trimmed else None
        return {
            context["variant"]: GroupingComponent(
                id="message",
                values=[message_trimmed],
                hint=hint,
                similarity_encoder=text_shingle_encoder(5),
            )
        }
    else:
        return {
            context["variant"]: GroupingComponent(
                id="message",
                values=[interface.message or interface.formatted or ""],
                similarity_encoder=text_shingle_encoder(5),
            )
        }

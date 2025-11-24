import re
from dataclasses import dataclass

import orjson
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.spans.consumers.process_segments.types import CompatibleSpan, attribute_value

# Ported from Relay:
# https://github.com/getsentry/relay/blob/aad4b6099d12422e88dd5df49abae11247efdd99/relay-event-normalization/src/regexes.rs#L9
TRANSACTION_NAME_NORMALIZER_REGEX = re.compile(
    r"""(?x)
    (?P<uuid>[^/\\]*
        (?a:\b)[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?a:\b)
    [^/\\]*) |
    (?P<sha1>[^/\\]*
        (?a:\b)[0-9a-fA-F]{40}(?a:\b)
    [^/\\]*) |
    (?P<md5>[^/\\]*
        (?a:\b)[0-9a-fA-F]{32}(?a:\b)
    [^/\\]*) |
    (?P<date>[^/\\]*
        (?:
            (?:[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]\.[0-9]+([+-][0-2][0-9]:[0-5][0-9]|Z))|
            (?:[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]([+-][0-2][0-9]:[0-5][0-9]|Z))|
            (?:[0-9]{4}-[01][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]([+-][0-2][0-9]:[0-5][0-9]|Z))
        ) |
        (?:
            (?a:\b)(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?a:\s)+)?
            (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?a:\s)+
            (?:[0-9]{1,2})(?a:\s)+
            (?:[0-9]{2}:[0-9]{2}:[0-9]{2})(?a:\s)+
            [0-9]{4}
        ) |
        (?:
            (?a:\b)(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),(?a:\s)+)?
            (?:0[1-9]|[1-2]?[0-9]|3[01])(?a:\s)+
            (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?a:\s)+
            (?:19[0-9]{2}|[2-9][0-9]{3})(?a:\s)+
            (?:2[0-3]|[0-1][0-9]):([0-5][0-9])
            (?::(60|[0-5][0-9]))?(?a:\s)+
            (?:[-\+][0-9]{2}[0-5][0-9]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))
        )
    [^/\\]*) |
    (?P<hex>[^/\\]*
        (?a:\b)0[xX][0-9a-fA-F]+(?a:\b)
    [^/\\]*) |
    (?:^|[/\\])
    (?P<int>
        (:?[^%/\\]|%[0-9a-fA-F]{2})*[0-9]{2,}
    [^/\\]*)""",
    re.UNICODE,
)


def normalize_segment_name(segment_span: CompatibleSpan):
    segment_name = attribute_value(
        segment_span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME
    ) or segment_span.get("name")
    if segment_name:
        _scrub_identifiers(segment_span, segment_name)


@dataclass(frozen=True)
class Remark:
    ty: str
    rule_id: str
    range: tuple[int, int]

    def serialize(self) -> list:
        return [self.rule_id, self.ty, self.range[0], self.range[1]]


# Ported from Relay:
# https://github.com/getsentry/relay/blob/aad4b6099d12422e88dd5df49abae11247efdd99/relay-event-normalization/src/transactions/processor.rs#L350
def _scrub_identifiers(segment_span: CompatibleSpan, segment_name: str):
    matches = TRANSACTION_NAME_NORMALIZER_REGEX.finditer(segment_name)
    remarks = []
    for m in matches:
        remarks.extend(
            [
                Remark(ty="s", rule_id=group_name, range=(m.start(group_name), m.end(group_name)))
                for group_name in m.groupdict().keys()
                if m.start(group_name) > -1
            ]
        )
    if len(remarks) == 0:
        return

    remarks.sort(key=lambda remark: remark.range[1])
    str_parts: list[str] = []
    last_end = 0
    for remark in remarks:
        start, end = remark.range
        str_parts.append(segment_name[last_end:start])
        str_parts.append("*")
        last_end = end
    str_parts.append(segment_name[last_end:])
    normalized_segment_name = "".join(str_parts)

    segment_span["name"] = normalized_segment_name
    attributes = segment_span.get("attributes") or {}
    attributes[ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME] = {
        "type": "string",
        "value": normalized_segment_name,
    }
    attributes[ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE] = {
        "type": "string",
        "value": "sanitized",
    }
    attributes[f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}"] = {
        "type": "string",
        "value": orjson.dumps({"meta": {"": {"rem": [r.serialize() for r in remarks]}}}).decode(),
    }
    segment_span["attributes"] = attributes

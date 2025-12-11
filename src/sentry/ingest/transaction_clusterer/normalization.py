import re
from collections.abc import Sequence
from dataclasses import dataclass

import orjson
import sentry_sdk
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.ingest.transaction_clusterer.datasource import TRANSACTION_SOURCE_SANITIZED
from sentry.ingest.transaction_clusterer.rules import get_sorted_rules_from_redis
from sentry.models.project import Project
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


def normalize_segment_name(project: Project, segment_span: CompatibleSpan):
    segment_name = attribute_value(
        segment_span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME
    ) or segment_span.get("name")
    if segment_name:
        _scrub_identifiers(segment_span, segment_name)
        _apply_clustering_rules(project, segment_span, segment_name)


@dataclass(frozen=True)
class Remark:
    ty: str
    rule_id: str
    range: tuple[int, int] | None

    def serialize(self) -> list:
        serialized: list[str | int] = [self.rule_id, self.ty]
        if self.range:
            serialized.extend([self.range[0], self.range[1]])
        return serialized


# Ported from Relay:
# https://github.com/getsentry/relay/blob/aad4b6099d12422e88dd5df49abae11247efdd99/relay-event-normalization/src/transactions/processor.rs#L350
@sentry_sdk.trace
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

    remarks.sort(key=lambda remark: remark.range[1])  # type: ignore[index]
    str_parts: list[str] = []
    last_end = 0
    for remark in remarks:
        assert remark.range is not None  # for typing - always set above
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
        "value": TRANSACTION_SOURCE_SANITIZED,
    }
    attributes[f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}"] = {
        "type": "string",
        "value": orjson.dumps({"meta": {"": {"rem": [r.serialize() for r in remarks]}}}).decode(),
    }
    segment_span["attributes"] = attributes


@sentry_sdk.trace
def _apply_clustering_rules(
    project: Project, segment_span: CompatibleSpan, original_segment_name: str
):
    segment_name = attribute_value(
        segment_span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME
    ) or segment_span.get("name")
    assert segment_name is not None
    segment_name_parts = segment_name.split("/")

    rules = get_sorted_rules_from_redis(ClustererNamespace.TRANSACTIONS, project)
    for rule, _ in rules:
        if clustered_name := _apply_clustering_rule_to_segment_name(segment_name_parts, rule):
            segment_span["name"] = clustered_name
            attributes = segment_span.get("attributes") or {}
            attributes[ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME] = {
                "type": "string",
                "value": clustered_name,
            }
            attributes[ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE] = {
                "type": "string",
                "value": TRANSACTION_SOURCE_SANITIZED,
            }
            attributes[f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}"] = {
                "type": "string",
                "value": orjson.dumps(
                    {
                        "meta": {
                            "": {
                                "val": original_segment_name,
                                "rem": [Remark(ty="s", rule_id=rule, range=None).serialize()],
                            }
                        }
                    },
                ).decode(),
            }
            segment_span["attributes"] = attributes
            return


def _apply_clustering_rule_to_segment_name(
    segment_name_parts: Sequence[str], rule: str
) -> str | None:
    """Tries to apply the given `rule` to the segment name given as a
    `/`-separated sequence in `segment_name_parts`. Returns a clustered segment
    name if the rule matches, or `None` if it does not."""
    output = []
    rule_parts = rule.split("/")
    for i, rule_part in enumerate(rule_parts):
        if i >= len(segment_name_parts):
            # A segment name only matches a longer rule if the remainder of
            # the rule is a multi-part wildcard (`**`).
            if rule_part == "**":
                break
            else:
                return None

        segment_name_part = segment_name_parts[i]
        if rule_part == "**":
            # `**`` matches the remainder of the segment name but does not replace it.
            output.extend([part for part in segment_name_parts[i:]])
            break

        if rule_part == "*" and segment_name_part != "":
            # `*` matches a single part and replaces it in the output with `*`.
            output.append("*")
        elif rule_part == segment_name_part:
            # The segment name part and rule part match, so keep applying this rule.
            output.append(segment_name_part)
        else:
            # If the segment name part and rule part didn't match, then this
            # whole rule doesn't match.
            return None

    return "/".join(output)

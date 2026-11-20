from enum import StrEnum


class ApiRule(StrEnum):
    """
    Rule codes tracked by the API guidelines tooling

    Each rule is defined, with its message, in tools/flake8_plugin.py. S021-S023
    and S034 are listed for reference: they're always enforced and have no baseline. Only
    S025-S028 are baselined. Later stages add their codes here
    """

    S021 = "S021"
    S022 = "S022"
    S023 = "S023"
    S025 = "S025"
    S026 = "S026"
    S027 = "S027"
    S028 = "S028"
    S034 = "S034"


# the only rules whose existing findings are kept as a baseline of legacy debt. Rules that are
# always enforced (S021-S023, S034) have no baseline
BASELINED_RULES = frozenset({ApiRule.S025, ApiRule.S026, ApiRule.S027, ApiRule.S028})

# one line per rule, shared by the report card legend, the Slack post and PR warnings so they say
# the same thing. The full messages are in tools/flake8_plugin.py
RULE_SUMMARIES: dict[ApiRule, str] = {
    ApiRule.S021: "a response type in @extend_schema is missing from the Response[T] annotation",
    ApiRule.S022: "a published method's response type is missing or a bare Response",
    ApiRule.S023: "a field left out of the public schema has no reason",
    ApiRule.S025: "validated input isn't declared in @extend_schema",
    ApiRule.S026: "query or body param read without a declared serializer",
    ApiRule.S027: "query or body param read with a computed key",
    ApiRule.S028: "the whole query string or body is handed to a helper",
    ApiRule.S034: "a returned status code isn't declared in @extend_schema responses",
}

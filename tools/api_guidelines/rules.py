from dataclasses import dataclass
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


@dataclass(frozen=True)
class RuleConfig:
    """
    `summary` one line shared by the report card legend, the Slack post and PR warnings so they say
    the same thing. The full messages are in tools/flake8_plugin.py
    `baselined` whether existing findings are kept in exceptions.json as legacy debt. Rules that are
    always enforced (S021-S023, S034) have no baseline
    """

    summary: str
    baselined: bool = False


RULES: dict[ApiRule, RuleConfig] = {
    ApiRule.S021: RuleConfig(
        "a response type in @extend_schema is missing from the Response[T] annotation"
    ),
    ApiRule.S022: RuleConfig("a published method's response type is missing or a bare Response"),
    ApiRule.S023: RuleConfig("a field left out of the public schema has no reason"),
    ApiRule.S025: RuleConfig("validated input isn't declared in @extend_schema", baselined=True),
    ApiRule.S026: RuleConfig(
        "query or body param read without a declared serializer", baselined=True
    ),
    ApiRule.S027: RuleConfig("query or body param read with a computed key", baselined=True),
    ApiRule.S028: RuleConfig(
        "the whole query string or body is handed to a helper", baselined=True
    ),
    ApiRule.S034: RuleConfig("a returned status code isn't declared in @extend_schema responses"),
}

BASELINED_RULES = frozenset(rule for rule, config in RULES.items() if config.baselined)

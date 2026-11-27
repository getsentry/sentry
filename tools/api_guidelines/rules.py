from dataclasses import dataclass
from enum import StrEnum, unique


# a duplicate code would otherwise become a silent alias of the first rule
@unique
class ApiRule(StrEnum):
    """
    Rule codes tracked by the API guidelines tooling, from every source in RuleSource

    The flake rules are defined, with their messages, in tools/flake8_plugin.py. S021-S023
    and S034 are listed for reference: they're always enforced and have no baseline. Only
    S025-S028 are baselined. S036-S037 come from the OpenAPI response check, whose findings
    live in tests/apidocs/openapi-response-baseline.json. Later stages add their codes here
    """

    S021 = "S021"
    S022 = "S022"
    S023 = "S023"
    S025 = "S025"
    S026 = "S026"
    S027 = "S027"
    S028 = "S028"
    S034 = "S034"
    S036 = "S036"
    S037 = "S037"


class RuleSource(StrEnum):
    """Where a rule's findings come from"""

    # tools/flake8_plugin.py
    FLAKE8 = "flake8"
    # the test responses src/sentry/testutils/pytest/openapi_responses.py checks against the schema
    OPENAPI_RESPONSE = "openapi_response"


@dataclass(frozen=True)
class RuleConfig:
    """
    `summary` one line shared by the report card legend, the Slack post and PR warnings so they say
    the same thing. The full messages are in the rule's source
    `source` where the rule's findings come from
    `baselined` whether existing findings are kept in exceptions.json as legacy debt. Rules that are
    always enforced (S021-S023, S034) have no baseline
    `title` a plain-words heading for the PR comment, which only lists baselined rules
    `fix` one line on how to fix it, shown under `title`
    """

    summary: str
    source: RuleSource
    baselined: bool = False
    title: str = ""
    fix: str = ""


RULES: dict[ApiRule, RuleConfig] = {
    ApiRule.S021: RuleConfig(
        "a response type in @extend_schema is missing from the Response[T] annotation",
        source=RuleSource.FLAKE8,
    ),
    ApiRule.S022: RuleConfig(
        "a published method's response type is missing or a bare Response",
        source=RuleSource.FLAKE8,
    ),
    ApiRule.S023: RuleConfig(
        "a field left out of the public schema has no reason", source=RuleSource.FLAKE8
    ),
    ApiRule.S025: RuleConfig(
        "validated input isn't declared in @extend_schema",
        source=RuleSource.FLAKE8,
        baselined=True,
        title="Validated input that isn't in the schema",
        fix="Add the serializer to `@extend_schema(parameters=...)` or `request=`.",
    ),
    ApiRule.S026: RuleConfig(
        "query or body param read without a declared serializer",
        source=RuleSource.FLAKE8,
        baselined=True,
        title="Params read straight off the request",
        fix="Read them through a serializer declared in `@extend_schema` so they show up in the docs.",
    ),
    ApiRule.S027: RuleConfig(
        "query or body param read with a computed key",
        source=RuleSource.FLAKE8,
        baselined=True,
        title="Params read with a computed key",
        fix="Read them through a serializer declared in `@extend_schema`, since no schema can document a computed key.",
    ),
    ApiRule.S028: RuleConfig(
        "the whole query string or body is passed into a call",
        source=RuleSource.FLAKE8,
        baselined=True,
        title="The whole query string or body passed into a call",
        fix="Validate it with a serializer declared in `@extend_schema` before passing it on.",
    ),
    ApiRule.S034: RuleConfig(
        "a returned status code isn't declared in @extend_schema responses",
        source=RuleSource.FLAKE8,
    ),
    ApiRule.S036: RuleConfig(
        "a test got a status code the schema's responses don't document",
        source=RuleSource.OPENAPI_RESPONSE,
    ),
    ApiRule.S037: RuleConfig(
        "a test got a response body that doesn't match the schema",
        source=RuleSource.OPENAPI_RESPONSE,
    ),
}

BASELINED_RULES = frozenset(rule for rule, config in RULES.items() if config.baselined)

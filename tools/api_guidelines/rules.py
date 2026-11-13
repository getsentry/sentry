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

# the rules whose findings come back from get_api_violations. The others (S021-S023, S034) report
# straight to flake8 for now. When a rule moves onto structured output, add it here in the same PR
STRUCTURED_RULES = frozenset({ApiRule.S025, ApiRule.S026, ApiRule.S027, ApiRule.S028})

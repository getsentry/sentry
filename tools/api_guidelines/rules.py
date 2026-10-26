from enum import StrEnum


class ApiRule(StrEnum):
    """
    Rule codes tracked by the API guidelines tooling

    Each rule is defined, with its message, in tools/flake8_plugin.py. S021-S023
    are listed for reference: they're always enforced and have no baseline. Only
    S025-S028 are baselined. Later stages add their codes here
    """

    S021 = "S021"
    S022 = "S022"
    S023 = "S023"
    S025 = "S025"
    S026 = "S026"
    S027 = "S027"
    S028 = "S028"

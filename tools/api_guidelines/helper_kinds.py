from enum import StrEnum


class Kind(StrEnum):
    """How a call to a possible helper is written, as recorded by tools/flake8_plugin.py."""

    # helper(...)
    NORMAL_FUNCTION = "plain"
    # self.helper(...)
    CLASS_METHOD = "self"
    # super().helper(...)
    PARENT_CLASS_METHOD = "super"

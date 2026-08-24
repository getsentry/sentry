from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .exceptions import InvalidEnhancerConfig

ACTIONS = ["group", "app"]
ACTION_BITSIZE = 8
# Ensure that the number of possible actions is smaller than the number of numbers which can be
# represented with `ACTION_BITSIZE` bits
assert len(ACTIONS) < 1 << ACTION_BITSIZE  # This is 2^ACTION_BITSIZE
ACTION_FLAGS = {
    # Each key is the value to which to set the attribute (`in_app` or `contributes`), followed by
    # the range (whether the action should apply to the given frame, frames above it, or frames
    # below it)
    (True, None): 0,
    (True, "up"): 1,
    (True, "down"): 2,
    (False, None): 3,
    (False, "up"): 4,
    (False, "down"): 5,
}
REVERSE_ACTION_FLAGS = {v: k for k, v in ACTION_FLAGS.items()}


class EnhancementAction:
    # True if this action updates a frame's `category` or `in_app` value
    is_classifier: bool
    # True if this action updates the `contributes` value of either a frame or the stacktrace
    sets_contributes: bool

    @classmethod
    def _from_config_structure(cls, val: list[str] | int, version: int) -> EnhancementAction:
        if isinstance(val, list):  # This is a `VarAction`
            variable, value = val
            return VarAction(variable, value)
        # Otherwise, assume it's a `FlagAction`, since those are the only two types we currently have
        flag, range_direction = REVERSE_ACTION_FLAGS[val >> ACTION_BITSIZE]
        return FlagAction(ACTIONS[val & 0xF], flag, range_direction)

    def _to_config_structure(self, version: int) -> int | list[str | int]:
        raise NotImplementedError()


class FlagAction(EnhancementAction):
    """
    An action which sets either a frame's `contributes` value or its `in_app` value.

    May optionally set the value for all frames above or below it in the stacktrace as well.
    """

    def __init__(self, key: str, flag: bool, range: str | None) -> None:
        self.key = key  # The type of change (`app` or `group`)
        self.flag = flag  # True for `+app/+group` rules, False for `-app/-group` rules
        self.range = range  # None (apply the action to this frame), "up", or "down"
        self.is_classifier = key == "app"
        self.sets_contributes = key == "group"

    def __str__(self) -> str:
        return "{}{}{}".format(
            {"up": "^", "down": "v", None: ""}.get(self.range),
            "+" if self.flag else "-",
            self.key,
        )

    def _to_config_structure(self, version: int) -> int:
        """
        Convert the action into an integer by
            - converting the combination of its boolean value (if it's a `+app/+group` rule or a
              `-app/-group` rule) and its range (if it applies to this frame, frames above, or
              frames below) into a number (see `ACTION_FLAGS`) and then multiplying that number by
              2^ACTION_BITSIZE
            - converting its type (app or group) into a number (using the index in `ACTIONS`)
            - bitwise or-ing those two numbers
        """
        return ACTIONS.index(self.key) | (ACTION_FLAGS[self.flag, self.range] << ACTION_BITSIZE)


class VarAction(EnhancementAction):
    _VALUE_PARSERS: dict[str, Callable[[Any], Any]] = {
        "max-frames": int,
        "min-frames": int,
        "category": lambda x: x,
    }

    def __init__(self, var: str, value: str) -> None:
        self.var = var
        self.is_classifier = self.var == "category"
        self.sets_contributes = self.var in ["min-frames", "max-frames"]

        try:
            self.value = VarAction._VALUE_PARSERS[var](value)
        except (ValueError, TypeError):
            raise InvalidEnhancerConfig(f"Invalid value '{value}' for '{var}'")
        except KeyError:
            raise InvalidEnhancerConfig(f"Unknown variable '{var}'")

    def __str__(self) -> str:
        return f"{self.var}={self.value}"

    def _to_config_structure(self, version: int) -> list[str | int]:
        # TODO: Can we switch this to a tuple so we can type it more exactly?
        return [self.var, self.value]

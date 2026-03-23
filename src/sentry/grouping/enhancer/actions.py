from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any

from sentry.grouping.component import BaseGroupingComponent
from sentry.grouping.enhancer.matchers import MatchFrame
from sentry.utils.safe import get_path, set_path

from .exceptions import InvalidEnhancerConfig

if TYPE_CHECKING:
    from sentry.grouping.enhancer.rules import EnhancementRule

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

    def apply_modifications_to_frame(
        self,
        frames: Sequence[dict[str, Any]],
        match_frames: list[MatchFrame],
        idx: int,
        rule: Any | None = None,
    ) -> None:
        pass

    def update_frame_components_contributions(
        self,
        components: list[BaseGroupingComponent],
        frames: list[dict[str, Any]],
        idx: int,
        rule: Any | None = None,
    ) -> None:
        pass

    def modify_stacktrace_state(self, state, rule):
        pass

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

    def _slice_to_range(self, seq: list[Any], idx: int) -> list[Any]:
        if self.range is None:
            return [seq[idx]]
        elif self.range == "down":
            return seq[:idx]
        elif self.range == "up":
            return seq[idx + 1 :]
        return []

    def _in_app_changed(self, frame: dict[str, Any]) -> bool:
        orig_in_app = get_path(frame, "data", "orig_in_app")

        if orig_in_app is not None:
            if orig_in_app == -1:
                orig_in_app = None
            return orig_in_app != frame.get("in_app")
        else:
            return False

    def apply_modifications_to_frame(
        self,
        frames: Sequence[dict[str, Any]],
        match_frames: list[MatchFrame],
        idx: int,
        rule: Any | None = None,
    ) -> None:
        # Change a frame or many to be in_app
        if self.key == "app":
            for match_frame in self._slice_to_range(match_frames, idx):
                match_frame["in_app"] = self.flag

    def update_frame_components_contributions(
        self,
        components: list[BaseGroupingComponent],
        frames: list[dict[str, Any]],
        idx: int,
        rule: EnhancementRule | None = None,
    ) -> None:
        rule_hint = "stacktrace rule"
        if rule:
            rule_hint = f"{rule_hint} ({rule.text})"

        sliced_components = self._slice_to_range(components, idx)
        sliced_frames = self._slice_to_range(frames, idx)
        for component, frame in zip(sliced_components, sliced_frames):
            if self.key == "group" and self.flag != component.contributes:
                component.update(
                    contributes=self.flag,
                    hint="{} by {}".format(self.flag and "un-ignored" or "ignored", rule_hint),
                )
            # The in app flag was set by `apply_modifications_to_frame`
            # but we want to add a hint if there is none yet.
            elif self.key == "app" and self._in_app_changed(frame):
                component.update(
                    hint="marked {} by {}".format(self.flag and "in-app" or "out of app", rule_hint)
                )


class VarAction(EnhancementAction):
    _VALUE_PARSERS: dict[str, Callable[[Any], Any]] = {
        "max-frames": int,
        "min-frames": int,
        "category": lambda x: x,
    }

    _FRAME_VARIABLES = {"category"}

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

        self._encoded_value = (
            self.value.encode("utf-8") if isinstance(self.value, str) else self.value
        )

    def __str__(self) -> str:
        return f"{self.var}={self.value}"

    def _to_config_structure(self, version: int) -> list[str | int]:
        # TODO: Can we switch this to a tuple so we can type it more exactly?
        return [self.var, self.value]

    def modify_stacktrace_state(self, state, rule) -> None:
        if self.var not in VarAction._FRAME_VARIABLES:
            state.set(self.var, self.value, rule)

    def apply_modifications_to_frame(
        self,
        frames: Sequence[dict[str, Any]],
        match_frames: list[MatchFrame],
        idx: int,
        rule: Any | None = None,
    ) -> None:
        if self.var == "category":
            frame = frames[idx]
            set_path(frame, "data", "category", value=self.value)
            match_frames[idx]["category"] = self._encoded_value

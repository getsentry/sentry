from sentry.grouping.utils import get_rule_bool
from sentry.stacktraces.functions import set_in_app
from sentry.utils.compat import zip
from sentry.utils.safe import get_path, set_path

from .exceptions import InvalidEnhancerConfig

ACTIONS = ["group", "app", "prefix", "sentinel"]
ACTION_BITSIZE = {
    # version -> bit-size
    1: 4,
    2: 8,
}
assert len(ACTIONS) < 1 << max(ACTION_BITSIZE.values())
ACTION_FLAGS = {
    (True, None): 0,
    (True, "up"): 1,
    (True, "down"): 2,
    (False, None): 3,
    (False, "up"): 4,
    (False, "down"): 5,
}
REVERSE_ACTION_FLAGS = {v: k for k, v in ACTION_FLAGS.items()}


class Action:

    is_modifier = False
    is_updater = False

    def apply_modifications_to_frame(self, frames, match_frames, idx, rule=None):
        pass

    def update_frame_components_contributions(self, components, frames, idx, rule=None):
        pass

    def modify_stacktrace_state(self, state, rule):
        pass

    @property
    def is_modifier(self):
        """ Does this action modify the frame? """
        return self._is_modifier

    @property
    def is_updater(self):
        """ Does this action update grouping components? """
        return self._is_updater

    @classmethod
    def _from_config_structure(cls, val, version):
        if isinstance(val, list):
            return VarAction(val[0], val[1])
        flag, range = REVERSE_ACTION_FLAGS[val >> ACTION_BITSIZE[version]]
        return FlagAction(ACTIONS[val & 0xF], flag, range)


class FlagAction(Action):
    def __init__(self, key, flag, range):
        self.key = key
        self._is_updater = key in {"group", "app", "prefix", "sentinel"}
        self._is_modifier = key == "app"
        self.flag = flag
        self.range = range

    def __str__(self):
        return "{}{}{}".format(
            {"up": "^", "down": "v"}.get(self.range, ""),
            self.flag and "+" or "-",
            self.key,
        )

    def _to_config_structure(self, version):
        return ACTIONS.index(self.key) | (
            ACTION_FLAGS[self.flag, self.range] << ACTION_BITSIZE[version]
        )

    def _slice_to_range(self, seq, idx):
        if self.range is None:
            return [seq[idx]]
        elif self.range == "down":
            return seq[:idx]
        elif self.range == "up":
            return seq[idx + 1 :]
        return []

    def _in_app_changed(self, frame, component):
        orig_in_app = get_path(frame, "data", "orig_in_app")

        if orig_in_app is not None:
            if orig_in_app == -1:
                orig_in_app = None
            return orig_in_app != frame.get("in_app")
        else:
            return self.flag == component.contributes

    def apply_modifications_to_frame(self, frames, match_frames, idx, rule=None):
        # Grouping is not stored on the frame
        if self.key == "group":
            return
        if self.key == "app":
            for frame, match_frame in self._slice_to_range(zip(frames, match_frames), idx):
                set_in_app(frame, self.flag)
                match_frame["in_app"] = frame["in_app"]

    def update_frame_components_contributions(self, components, frames, idx, rule=None):
        rule_hint = "stack trace rule"
        if rule:
            rule_hint = f"{rule_hint} ({rule.matcher_description})"

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
            elif self.key == "app" and self._in_app_changed(frame, component):
                component.update(
                    hint="marked {} by {}".format(self.flag and "in-app" or "out of app", rule_hint)
                )

            elif self.key == "prefix":
                component.update(
                    is_prefix_frame=True, hint=f"marked as prefix frame by {rule_hint}"
                )

            elif self.key == "sentinel":
                component.update(
                    is_sentinel_frame=True, hint=f"marked as sentinel frame by {rule_hint}"
                )


class VarAction(Action):
    range = None

    _VALUE_PARSERS = {
        "max-frames": int,
        "min-frames": int,
        "invert-stacktrace": get_rule_bool,
        "category": lambda x: x,
    }

    _FRAME_VARIABLES = {"category"}

    def __init__(self, var, value):
        self.var = var
        self._is_modifier = self.var == "category"
        self._is_updater = self.var not in VarAction._FRAME_VARIABLES

        try:
            self.value = VarAction._VALUE_PARSERS[var](value)
        except (ValueError, TypeError):
            raise InvalidEnhancerConfig(f"Invalid value '{value}' for '{var}'")
        except KeyError:
            raise InvalidEnhancerConfig(f"Unknown variable '{var}'")

        self._encoded_value = (
            self.value.encode("utf-8") if isinstance(self.value, str) else self.value
        )

    def __str__(self):
        return f"{self.var}={self.value}"

    def _to_config_structure(self, version):
        return [self.var, self.value]

    def modify_stacktrace_state(self, state, rule):
        if self.var not in VarAction._FRAME_VARIABLES:
            state.set(self.var, self.value, rule)

    def apply_modifications_to_frame(self, frames, match_frames, idx, rule=None):
        if self.var == "category":
            frame = frames[idx]
            set_path(frame, "data", "category", value=self.value)
            match_frames[idx]["category"] = self._encoded_value

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Literal, NotRequired, TypedDict

from sentry.grouping.fingerprinting.types import FingerprintInfo
from sentry.stacktraces.functions import get_function_name_for_frame
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.stacktraces.processing import get_crash_frame_from_event_data
from sentry.utils.event_frames import find_stack_frames
from sentry.utils.safe import get_path
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

if TYPE_CHECKING:
    from sentry.services.eventstore.models import Event


logger = logging.getLogger("sentry.events.grouping")

FINGERPRINT_VARIABLE_REGEX = re.compile(r"\{\{\s*(\S+)\s*\}\}")
DEFAULT_FINGERPRINT_VARIABLE = "{{ default }}"


class _MessageInfo(TypedDict):
    message: str


class _LogInfo(TypedDict):
    logger: NotRequired[str]
    level: NotRequired[str]


class _ExceptionInfo(TypedDict):
    type: str | None
    value: str | None


class _FrameInfo(TypedDict):
    function: str
    abs_path: str | None
    filename: str | None
    module: str | None
    package: str | None
    app: bool | None


class _SdkInfo(TypedDict):
    sdk: str


class _FamilyInfo(TypedDict):
    family: str


class _ReleaseInfo(TypedDict):
    release: str | None


class EventDatastore:
    def __init__(self, event: Mapping[str, Any]) -> None:
        self.event = event
        self._exceptions: list[_ExceptionInfo] | None = None
        self._frames: list[_FrameInfo] | None = None
        self._messages: list[_MessageInfo] | None = None
        self._log_info: list[_LogInfo] | None = None
        self._toplevel: list[_MessageInfo | _ExceptionInfo] | None = None
        self._tags: list[dict[str, str | None]] | None = None
        self._sdk: list[_SdkInfo] | None = None
        self._family: list[_FamilyInfo] | None = None
        self._release: list[_ReleaseInfo] | None = None

    def get_values(self, match_type: str) -> list[dict[str, Any]]:
        """
        Pull values from all the spots in the event appropriate to the given match type.
        """
        return getattr(self, "_get_" + match_type)()

    def _get_messages(self) -> list[_MessageInfo]:
        if self._messages is None:
            self._messages = []
            message = get_path(self.event, "logentry", "formatted", filter=True)
            if message:
                self._messages.append({"message": message.strip()})
        return self._messages

    def _get_log_info(self) -> list[_LogInfo]:
        if self._log_info is None:
            log_info: _LogInfo = {}
            logger_name = get_path(self.event, "logger", filter=True)
            if logger_name:
                log_info["logger"] = logger_name
            level = get_path(self.event, "level", filter=True)
            if level:
                log_info["level"] = level
            if log_info:
                self._log_info = [log_info]
            else:
                self._log_info = []
        return self._log_info

    def _get_exceptions(self) -> list[_ExceptionInfo]:
        if self._exceptions is None:
            self._exceptions = []
            for exc in get_path(self.event, "exception", "values", filter=True) or ():
                self._exceptions.append(
                    {
                        "type": exc.get("type"),
                        "value": exc["value"].strip() if exc.get("value") else None,
                    }
                )
        return self._exceptions

    def _get_frames(self) -> list[_FrameInfo]:
        if self._frames is None:
            self._frames = frames = []

            def _push_frame(frame: dict[str, object]) -> None:
                platform = frame.get("platform") or self.event.get("platform")
                func = get_function_name_for_frame(frame, platform)
                frames.append(
                    {
                        "function": func or "<unknown>",
                        "abs_path": frame.get("abs_path") or frame.get("filename"),
                        "filename": frame.get("filename"),
                        "module": frame.get("module"),
                        "package": frame.get("package"),
                        "app": frame.get("in_app"),
                    }
                )

            find_stack_frames(self.event, _push_frame)
        return self._frames

    def _get_toplevel(self) -> list[_MessageInfo | _ExceptionInfo]:
        if self._toplevel is None:
            self._toplevel = [*self._get_messages(), *self._get_exceptions()]
        return self._toplevel

    def _get_tags(self) -> list[dict[str, str | None]]:
        if self._tags is None:
            self._tags = [
                {
                    "tags.%s" % k: v.strip() if v else None
                    for (k, v) in get_path(self.event, "tags", filter=True) or ()
                }
            ]
        return self._tags

    def _get_sdk(self) -> list[_SdkInfo]:
        if self._sdk is None:
            self._sdk = [{"sdk": normalized_sdk_tag_from_event(self.event)}]
        return self._sdk

    def _get_family(self) -> list[_FamilyInfo]:
        self._family = self._family or [
            {"family": get_behavior_family_for_platform(self.event.get("platform"))}
        ]
        return self._family

    def _get_release(self) -> list[_ReleaseInfo]:
        self._release = self._release or [
            {"release": self.event["release"].strip() if self.event.get("release") else None}
        ]
        return self._release


def parse_fingerprint_entry_as_variable(entry: str) -> str | None:
    """
    Determine if the given fingerprint entry is a variable, and if it is, return its key (that is,
    extract the variable name from a variable string of the form "{{ var_name }}"). If the given
    entry isn't the correct form to be a variable, return None.
    """
    match = FINGERPRINT_VARIABLE_REGEX.match(entry)
    if match is not None and match.end() == len(entry):
        return match.group(1)
    return None


def is_default_fingerprint_var(value: str) -> bool:
    return parse_fingerprint_entry_as_variable(value) == "default"


def get_fingerprint_type(
    fingerprint: list[str] | None,
) -> Literal["default", "hybrid", "custom"] | None:
    """
    Examine a fingerprint to determine if it's custom, hybrid, or the default fingerprint.

    Accepts (and then returns) None for convenience, so the fingerprint's existence doesn't have to
    be separately checked.
    """
    if not fingerprint:
        return None

    return (
        "default"
        if len(fingerprint) == 1 and is_default_fingerprint_var(fingerprint[0])
        else (
            "hybrid"
            if any(is_default_fingerprint_var(entry) for entry in fingerprint)
            else "custom"
        )
    )


def get_custom_fingerprint_type(
    fingerprint_info: FingerprintInfo,
) -> Literal["built-in", "custom client", "custom server"]:
    matched_server_rule = fingerprint_info.get("matched_rule")
    if matched_server_rule:
        return "built-in" if matched_server_rule.get("is_builtin") else "custom server"
    else:
        return "custom client"


def resolve_fingerprint_variable(
    variable_key: str,
    event: Event,
    use_legacy_unknown_variable_handling: bool,
) -> str | None:
    if variable_key == "transaction":
        return event.data.get("transaction") or "<no-transaction>"

    elif variable_key == "message":
        message = (
            get_path(event.data, "logentry", "formatted")
            or get_path(event.data, "logentry", "message")
            or get_path(event.data, "exception", "values", -1, "value")
        )
        return message or "<no-message>"

    elif variable_key in ("type", "error.type"):
        exception_type = get_path(event.data, "exception", "values", -1, "type")
        return exception_type or "<no-type>"

    elif variable_key in ("value", "error.value"):
        value = get_path(event.data, "exception", "values", -1, "value")
        return value or "<no-value>"

    elif variable_key in ("function", "stack.function"):
        frame = get_crash_frame_from_event_data(event.data)
        func = frame.get("function") if frame else None
        return func or "<no-function>"

    elif variable_key in ("path", "stack.abs_path"):
        frame = get_crash_frame_from_event_data(event.data)
        abs_path = frame.get("abs_path") or frame.get("filename") if frame else None
        return abs_path or "<no-abs-path>"

    elif variable_key == "stack.filename":
        frame = get_crash_frame_from_event_data(event.data)
        filename = frame.get("filename") or frame.get("abs_path") if frame else None
        return filename or "<no-filename>"

    elif variable_key in ("module", "stack.module"):
        frame = get_crash_frame_from_event_data(event.data)
        module = frame.get("module") if frame else None
        return module or "<no-module>"

    elif variable_key in ("package", "stack.package"):
        frame = get_crash_frame_from_event_data(event.data)
        pkg = frame.get("package") if frame else None
        if pkg:
            # If the package is formatted as either a POSIX or Windows path, grab the last segment
            pkg = pkg.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        return pkg or "<no-package>"

    elif variable_key == "level":
        return event.data.get("level") or "<no-level>"

    elif variable_key == "logger":
        return event.data.get("logger") or "<no-logger>"

    elif variable_key.startswith("tags."):
        # Turn "tags.some_tag" into just "some_tag"
        requested_tag = variable_key[5:]
        for tag_name, tag_value in event.data.get("tags") or ():
            if tag_name == requested_tag and tag_value is not None:
                return tag_value
        return "<no-value-for-tag-%s>" % requested_tag
    else:
        # TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we
        # can remove `use_legacy_unknown_variable_handling` and just return the string. (At that
        # point we can also change the return type of this function to just be `str`.)
        return (
            None
            if use_legacy_unknown_variable_handling
            else "<unrecognized-variable-%s>" % variable_key
        )


def resolve_fingerprint_values(
    fingerprint: list[str], event: Event, use_legacy_unknown_variable_handling: bool = False
) -> list[str]:
    def _resolve_single_entry(entry: str) -> str:
        variable_key = parse_fingerprint_entry_as_variable(entry)
        if variable_key == "default":  # entry is some variation of `{{ default }}`
            return DEFAULT_FINGERPRINT_VARIABLE
        if variable_key is None:  # entry isn't a variable
            return entry

        # TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we
        # can remove `use_legacy_unknown_variable_handling` and just return the value given by
        # `resolve_fingerprint_variable`
        resolved_value = resolve_fingerprint_variable(
            variable_key, event, use_legacy_unknown_variable_handling
        )

        # TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we
        # can remove this
        if resolved_value is None:  # variable wasn't recognized
            return entry
        return resolved_value

    return [_resolve_single_entry(entry) for entry in fingerprint]


def expand_title_template(
    template: str, event: Event, use_legacy_unknown_variable_handling: bool = False
) -> str:
    def _handle_match(match: re.Match[str]) -> str:
        variable_key = match.group(1)
        # TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we
        # can remove `use_legacy_unknown_variable_handling` and just return the value given by
        # `resolve_fingerprint_variable`
        resolved_value = resolve_fingerprint_variable(
            variable_key, event, use_legacy_unknown_variable_handling
        )

        # TODO: Once we have fully transitioned off of the `newstyle:2023-01-11` grouping config, we
        # can remove this
        if resolved_value is not None:
            return resolved_value
        # If the variable can't be resolved, return it as is
        return match.group(0)

    return FINGERPRINT_VARIABLE_REGEX.sub(_handle_match, template)

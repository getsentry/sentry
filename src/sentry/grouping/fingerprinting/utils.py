from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, NotRequired, TypedDict

from sentry.stacktraces.functions import get_function_name_for_frame
from sentry.stacktraces.platform import get_behavior_family_for_platform
from sentry.utils.event_frames import find_stack_frames
from sentry.utils.safe import get_path
from sentry.utils.tag_normalization import normalized_sdk_tag_from_event

logger = logging.getLogger("sentry.events.grouping")


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
        self._tags: list[dict[str, str]] | None = None
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
                self._messages.append({"message": message})
        return self._messages

    def _get_log_info(self) -> list[_LogInfo]:
        if self._log_info is None:
            log_info: _LogInfo = {}
            logger = get_path(self.event, "logger", filter=True)
            if logger:
                log_info["logger"] = logger
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
                        "value": exc.get("value"),
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

    def _get_tags(self) -> list[dict[str, str]]:
        if self._tags is None:
            self._tags = [
                {"tags.%s" % k: v for (k, v) in get_path(self.event, "tags", filter=True) or ()}
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
        self._release = self._release or [{"release": self.event.get("release")}]
        return self._release

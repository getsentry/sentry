from __future__ import annotations

import logging
import re
from collections.abc import Mapping, MutableMapping, Sequence
from typing import TYPE_CHECKING, Any, NamedTuple
from urllib.parse import urlparse

import sentry_sdk

from sentry.stacktraces.functions import set_in_app, trim_function_name
from sentry.utils import metrics
from sentry.utils.safe import get_path, set_path, setdefault_path
from sentry.utils.tracing import start_span

logger = logging.getLogger(__name__)
op = "stacktrace_processing"

if TYPE_CHECKING:
    from sentry.grouping.strategies.base import StrategyConfiguration

# Used to recognize context lines where Python's multiprocessing logic hard-codes variable values,
# leading to under-grouping. See:
#    https://github.com/python/cpython/blob/95259116ecb4346b570b9f87fd825d1d5901c4f1/Lib/multiprocessing/spawn.py#L91-L92
#    https://github.com/python/cpython/blob/95259116ecb4346b570b9f87fd825d1d5901c4f1/Lib/multiprocessing/popen_spawn_posix.py#L55-L56
#    https://github.com/python/cpython/blob/95259116ecb4346b570b9f87fd825d1d5901c4f1/Lib/multiprocessing/popen_spawn_win32.py#L57-L58
PYTHON_MULTIPROCESSING_CALL_REGEX = re.compile(
    r"from multiprocessing\.spawn import spawn_main; spawn_main\("
    r"(tracker_fd|parent_pid)=\d+, pipe_handle=\d+"  # Posix and Windows use different initial kwargs
    r"\)"
)


class StacktraceInfo(NamedTuple):
    stacktrace: dict[str, Any]
    container: dict[str, Any]
    platforms: set[str]
    is_exception: bool
    exception_type: str | None
    exception_module: str | None

    def get_frames(self) -> Sequence[dict[str, Any]]:
        return _safe_get_frames(self.stacktrace)


def _safe_get_frames(stacktrace) -> Sequence[dict[str, Any]]:
    frames = []
    if stacktrace and stacktrace.get("frames"):
        frames = [frame for frame in stacktrace.get("frames") if frame]
    return frames


def find_stacktraces_in_data(
    data: Mapping[str, Any], include_raw: bool = False
) -> list[StacktraceInfo]:
    """
    Finds all stacktraces in a given data blob and returns them together with some meta information.

    If `include_raw` is True, then also raw stacktraces are included.
    """
    rv = []

    def _append_stacktrace(
        stacktrace: Any,
        # The entry in `exception.values` or `threads.values` containing the `stacktrace` attribute,
        # or None for top-level stacktraces
        container: Any = None,
        # Whether or not the container is from `exception.values`
        is_exception: bool = False,
        # The exception type (e.g., "ValueError") if this stacktrace belongs to an exception
        exception_type: str | None = None,
        # The exception module (e.g., "__builtins__") if this stacktrace belongs to an exception
        exception_module: str | None = None,
    ) -> None:
        frames = _safe_get_frames(stacktrace)

        if not stacktrace or not frames:
            return

        platforms = _get_frames_metadata(frames, data.get("platform", "unknown"))
        rv.append(
            StacktraceInfo(
                stacktrace=stacktrace,
                container=container,
                platforms=platforms,
                is_exception=is_exception,
                exception_type=exception_type,
                exception_module=exception_module,
            )
        )

    # Look for stacktraces under the key `exception`
    for exc in get_path(data, "exception", "values", filter=True, default=()):
        _append_stacktrace(
            exc.get("stacktrace"),
            container=exc,
            is_exception=True,
            exception_type=exc.get("type"),
            exception_module=exc.get("module"),
        )

    # Look for stacktraces under the key `stacktrace`
    _append_stacktrace(data.get("stacktrace"))

    # The native family includes stacktraces under threads
    for thread in get_path(data, "threads", "values", filter=True, default=()):
        _append_stacktrace(thread.get("stacktrace"), container=thread)

    if include_raw:
        # Iterate over a copy of rv, otherwise, it will infinitely append to itself
        for info in rv[:]:
            if info.container is not None:
                # Treat the raw stacktrace as non-exception so exception-specific normalization
                # only applies once to its container.
                _append_stacktrace(info.container.get("raw_stacktrace"), container=info.container)

    return rv


def _get_frames_metadata(frames: Sequence[dict[str, Any]], fallback_platform: str) -> set[str]:
    """Create a set of platforms involved"""
    return {frame.get("platform", fallback_platform) for frame in frames}


def _normalize_in_app(stacktrace: Sequence[dict[str, str]]) -> str:
    """
    Ensures consistent values of in_app across a stacktrace. Returns a classification of the
    stacktrace as either "in-app-only", "system-only", or "mixed", for use in metrics.
    """
    has_in_app_frames = False
    has_system_frames = False

    # Default to false when grouping enhancers have not set in_app.
    for frame in stacktrace:
        if frame.get("in_app") is None:
            set_in_app(frame, False)

        if frame.get("in_app"):
            has_in_app_frames = True
        else:
            has_system_frames = True

    if has_in_app_frames and has_system_frames:
        return "mixed"
    elif has_in_app_frames:
        return "in-app-only"
    else:
        return "system-only"


def normalize_stacktraces_for_grouping(
    data: MutableMapping[str, Any], grouping_config: StrategyConfiguration | None = None
) -> None:
    """
    Applies grouping enhancement rules and ensure in_app is set on all frames.
    This also trims functions and pulls query strings off of filenames if necessary.
    """

    stacktrace_frames = []
    stacktrace_containers = []

    for stacktrace_info in find_stacktraces_in_data(data, include_raw=True):
        frames = stacktrace_info.get_frames()
        if frames:
            stacktrace_frames.append(frames)
            stacktrace_containers.append(
                stacktrace_info.container if stacktrace_info.is_exception else {}
            )

    if not stacktrace_frames:
        return

    platform = data.get("platform", "")
    sentry_sdk.set_tag("platform", platform)
    sentry_sdk.set_attribute("platform", platform)

    # Put the trimmed function names into the frames.  We only do this if
    # the trimming produces a different function than the function we have
    # otherwise stored in `function` to not make the payload larger
    # unnecessarily.
    with start_span(op=op, name="iterate_frames"):
        stripped_querystring = False
        for frames in stacktrace_frames:
            for frame in frames:
                _trim_function_name(frame, platform)

                # Restore the original in_app value before applying in-app stacktrace rules. This
                # lets us run grouping enhancers on the stacktrace multiple times, as would happen
                # during a grouping config transition, for example.
                orig_in_app = get_path(frame, "data", "orig_in_app")
                if orig_in_app is not None:
                    frame["in_app"] = None if orig_in_app == -1 else bool(orig_in_app)

                # Track the incoming `in_app` value, before we make any changes. This is different
                # from the `orig_in_app` value which may be set by
                # `apply_category_and_updated_in_app_to_frames`, because it's not tied to the value
                # changing as a result of stacktrace rules.
                client_in_app = frame.get("in_app")
                if client_in_app is not None:
                    set_path(frame, "data", "client_in_app", value=client_in_app)

                if platform == "javascript":
                    try:
                        parsed_filename = urlparse(frame.get("filename", ""))
                        if parsed_filename.query:
                            stripped_querystring = True
                            frame["filename"] = frame["filename"].replace(
                                f"?{parsed_filename.query}", ""
                            )
                    # ignore unparsable filenames
                    except Exception:
                        pass

                # Cpython's multiprocessing module generates code with hard-coded variable values
                # when spawning processes, which then makes our grouping logic see every random pair
                # of values as a different stacktrace. To fix this, we manually parameterize such
                # context lines. (See the regex definition above for code references.)
                #
                # Note: While it's true that all of the if conditions here make this a bit brittle,
                # a) Python internals don't change super frequently, and b) we want to make this
                # case as narrow as possible to avoid the cost of running the regex when we don't
                # need to, since this code runs on every frame of every event during ingest.
                context_line = frame.get("context_line")
                if (
                    context_line
                    and platform == "python"
                    and frame.get("module") == "__main__"
                    and frame.get("filename") == "<string>"
                    and frame.get("function") == "<module>"
                    and PYTHON_MULTIPROCESSING_CALL_REGEX.match(context_line)
                ):
                    setdefault_path(frame, "data", "orig_context_line", value=context_line)
                    # Turn `spawn_main(tracker_fd=11, pipe_handle=21)` into `spawn_main(tracker_fd=<int>, pipe_handle=<int>)`
                    # and `spawn_main(parent_pid=12, pipe_handle=31)` into `spawn_main(parent_pid=<int>, pipe_handle=<int>)`
                    frame["context_line"] = re.sub(r"=\d+", "=<int>", context_line)
                    metrics.incr(
                        "sentry.grouping.python_multiprocessing_line_parameterized",
                        tags={"platform": "posix" if "tracker_fd" in context_line else "windows"},
                    )

                    # TODO: Temporary log to see if other orgs have this problem or if it's just
                    # us, and to try to find a Windows example of this happening
                    logger.info(
                        "grouping.python_multiprocessing_line_parameterized",
                        extra={
                            "event_id": data.get("event_id"),
                            "project_id": data.get("project"),
                            "orig_line": context_line,
                            "platform": "posix" if "tracker_fd" in context_line else "windows",
                        },
                    )

                    # TODO: This can go away once we're fully transitioned off of the
                    # `newstyle:2023-01-11` grouping config
                    if grouping_config and grouping_config.initial_context.get(
                        "prevent_python_multiprocessing_context_line_parameterization"
                    ):
                        frame["context_line"] = context_line

        if stripped_querystring:
            # Fires once per event, regardless of how many frames' filenames were stripped
            metrics.incr("sentry.grouping.stripped_filename_querystrings")

    # If a grouping config is available, run grouping enhancers
    if grouping_config is not None:
        with start_span(op=op, name="apply_modifications_to_frame"):
            for frames, stacktrace_container in zip(stacktrace_frames, stacktrace_containers):
                # This call has a caching mechanism when the same stacktrace and rules are used
                grouping_config.enhancements.apply_category_and_updated_in_app_to_frames(
                    frames, platform, stacktrace_container
                )

    # normalize `in_app` values, noting and storing the event's mix of in-app and system frames, so
    # we can track the mix with a metric in cases where this event creates a new group
    frame_mixes = {"mixed": 0, "in-app-only": 0, "system-only": 0}

    for frames in stacktrace_frames:
        stacktrace_frame_mix = _normalize_in_app(frames)
        frame_mixes[stacktrace_frame_mix] += 1

    event_metadata = data.get("metadata") or {}
    event_metadata["in_app_frame_mix"] = (
        "in-app-only"
        if frame_mixes["in-app-only"] == len(stacktrace_frames)
        else "system-only"
        if frame_mixes["system-only"] == len(stacktrace_frames)
        else "mixed"
    )
    data["metadata"] = event_metadata


def _trim_function_name(frame: dict[str, Any], platform: str | None) -> None:
    function = frame.get("function")
    raw_function = frame.get("raw_function")

    # Nothing to trim or trimming has already been done
    if not function or raw_function is not None:
        return

    trimmed_function = trim_function_name(function, frame.get("platform", platform))
    if trimmed_function != function:
        frame["raw_function"] = function
        frame["function"] = trimmed_function


def get_crash_frame_from_event_data(data, frame_filter=None):
    """
    Return the highest (closest to the crash) in-app frame in the top stacktrace
    which doesn't fail the given filter test.

    If no such frame is available, return the highest non-in-app frame which
    otherwise meets the same criteria.

    Return None if any of the following are true:
        - there are no frames
        - all frames fail the given filter test
        - we're unable to find any frames nested in either event.exception or
          event.stacktrace, and there's anything other than exactly one thread
          in the data
    """

    frames = get_path(data, "exception", "values", -1, "stacktrace", "frames") or get_path(
        data, "stacktrace", "frames"
    )
    if not frames:
        threads = get_path(data, "threads", "values")
        if threads and len(threads) == 1:
            frames = get_path(threads, 0, "stacktrace", "frames")

    default = None
    for frame in reversed(frames or ()):
        if frame is None:
            continue
        if frame_filter is not None:
            if not frame_filter(frame):
                continue
        if frame.get("in_app"):
            return frame
        if default is None:
            default = frame

    if default:
        return default

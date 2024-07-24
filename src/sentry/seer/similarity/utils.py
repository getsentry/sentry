import logging
from typing import Any, TypeVar

from sentry import options
from sentry.eventstore.models import Event
from sentry.utils import metrics
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

MAX_FRAME_COUNT = 30
FULLY_MINIFIED_STACKTRACE_MAX_FRAME_COUNT = 20
SEER_ELIGIBLE_PLATFORMS = frozenset(["python", "javascript", "node"])


def _get_value_if_exists(exception_value: dict[str, Any]) -> str:
    return exception_value["values"][0] if exception_value.get("values") else ""


def get_stacktrace_string(data: dict[str, Any]) -> str:
    """Format a stacktrace string from the grouping information."""
    if not (
        get_path(data, "app", "hash") and get_path(data, "app", "component", "values")
    ) and not (
        get_path(data, "system", "hash") and get_path(data, "system", "component", "values")
    ):
        return ""

    # Get the data used for grouping
    if get_path(data, "app", "hash"):
        exceptions = data["app"]["component"]["values"]
    else:
        exceptions = data["system"]["component"]["values"]

    # Handle chained exceptions
    if exceptions and exceptions[0].get("id") == "chained-exception":
        exceptions = exceptions[0].get("values")

    frame_count = 0
    stacktrace_str = ""
    found_non_snipped_context_line = False
    result_parts = []

    # Reverse the list of exceptions in order to prioritize the outermost/most recent ones in cases
    # where there are chained exceptions and we end up truncating
    for exception in reversed(exceptions):
        if exception.get("id") not in ["exception", "threads"] or not exception.get("contributes"):
            continue

        # For each exception, extract its type, value, and up to 30 stacktrace frames
        exc_type, exc_value, frame_strings = "", "", []
        for exception_value in exception.get("values", []):
            if exception_value.get("id") == "type":
                exc_type = _get_value_if_exists(exception_value)
            elif exception_value.get("id") == "value":
                exc_value = _get_value_if_exists(exception_value)
            elif exception_value.get("id") == "stacktrace" and frame_count < MAX_FRAME_COUNT:
                contributing_frames = [
                    frame
                    for frame in exception_value["values"]
                    if frame.get("id") == "frame" and frame.get("contributes")
                ]
                contributing_frames = _discard_excess_frames(
                    contributing_frames, MAX_FRAME_COUNT, frame_count
                )
                frame_count += len(contributing_frames)

                for frame in contributing_frames:
                    frame_dict = {"filename": "", "function": "", "context-line": ""}
                    for frame_values in frame.get("values", []):
                        if frame_values.get("id") in frame_dict:
                            frame_dict[frame_values["id"]] = _get_value_if_exists(frame_values)

                    if not _is_snipped_context_line(frame_dict["context-line"]):
                        found_non_snipped_context_line = True

                    frame_strings.append(
                        f'  File "{frame_dict["filename"]}", function {frame_dict["function"]}\n    {frame_dict["context-line"]}\n'
                    )
        # Only exceptions have the type and value properties, so we don't need to handle the threads
        # case here
        header = f"{exc_type}: {exc_value}\n" if exception["id"] == "exception" else ""

        result_parts.append((header, frame_strings))

    final_frame_count = 0

    for header, frame_strings in result_parts:
        # For performance reasons, if the entire stacktrace is made of minified frames, restrict the
        # result to include only the first 20 frames, since minified frames are significantly more
        # token-dense than non-minified ones
        if not found_non_snipped_context_line:
            frame_strings = _discard_excess_frames(
                frame_strings, FULLY_MINIFIED_STACKTRACE_MAX_FRAME_COUNT, final_frame_count
            )
            final_frame_count += len(frame_strings)

        stacktrace_str += header + "".join(frame_strings)

    return stacktrace_str.strip()


def event_content_is_seer_eligible(event: Event) -> bool:
    """
    Determine if an event's contents makes it fit for using with Seer's similar issues model.
    """
    # TODO: Determine if we want to filter out non-sourcemapped events

    # If an event has no stacktrace, there's no data for Seer to analyze, so no point in making the
    # API call. If we ever start analyzing message-only events, we'll need to add `event.title in
    # PLACEHOLDER_EVENT_TITLES` to this check.
    if not get_path(event.data, "exception", "values", -1, "stacktrace", "frames") and not get_path(
        event.data, "threads", "values", -1, "stacktrace", "frames"
    ):
        return False

    if event.platform not in SEER_ELIGIBLE_PLATFORMS:
        return False

    return True


def killswitch_enabled(project_id: int, event: Event | None = None) -> bool:
    """
    Check both the global and similarity-specific Seer killswitches.
    """

    logger_extra = {"event_id": event.event_id if event else None, "project_id": project_id}

    if options.get("seer.global-killswitch.enabled"):
        logger.warning(
            "should_call_seer_for_grouping.seer_global_killswitch_enabled",
            extra=logger_extra,
        )
        metrics.incr("grouping.similarity.seer_global_killswitch_enabled")
        metrics.incr(
            "grouping.similarity.did_call_seer",
            sample_rate=1.0,
            tags={"call_made": False, "blocker": "global-killswitch"},
        )
        return True

    if options.get("seer.similarity-killswitch.enabled"):
        logger.warning(
            "should_call_seer_for_grouping.seer_similarity_killswitch_enabled",
            extra=logger_extra,
        )
        metrics.incr("grouping.similarity.seer_similarity_killswitch_enabled")
        metrics.incr(
            "grouping.similarity.did_call_seer",
            sample_rate=1.0,
            tags={"call_made": False, "blocker": "similarity-killswitch"},
        )
        return True

    return False


def filter_null_from_event_title(title: str) -> str:
    """
    Filter out null bytes from event title so that it can be saved in records table.
    """
    return title.replace("\x00", "")


T = TypeVar("T", dict[str, Any], str)


def _discard_excess_frames(frames: list[T], max_frames: int, current_frame_count: int) -> list[T]:
    if current_frame_count >= max_frames:
        return []

    # If adding in all of the new frames would put us over the limit, truncate the list
    if current_frame_count + len(frames) > max_frames:
        remaining_frames_allowed = max_frames - current_frame_count
        # Pull from the end of the list, since those frames are the most recent
        frames = frames[-remaining_frames_allowed:]

    return frames


def _is_snipped_context_line(context_line: str) -> bool:
    # This check is implicitly restricted to JS (and friends) events by the fact that the `{snip]`
    # is only added in the JS processor. See
    # https://github.com/getsentry/sentry/blob/d077a5bb7e13a5927794b35d9ae667a4f181feb7/src/sentry/lang/javascript/utils.py#L72-L77.
    return context_line.startswith("{snip}") and context_line.endswith("{snip}")

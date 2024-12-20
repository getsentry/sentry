import logging
from collections.abc import Mapping, Sequence
from enum import StrEnum
from typing import Any, TypedDict, TypeVar

from sentry import options
from sentry.eventstore.models import Event, GroupEvent
from sentry.killswitches import killswitch_matches_context
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

MAX_FRAME_COUNT = 30
MAX_EXCEPTION_COUNT = 30
FULLY_MINIFIED_STACKTRACE_MAX_FRAME_COUNT = 20
# Events' `platform` values are tested against this list before events are sent to Seer. Checking
# this separately from backfill status allows us to backfill projects which have events from
# multiple platforms, some supported and some not, and not worry about events from the unsupported
# platforms getting sent to Seer during ingest.
SEER_INELIGIBLE_EVENT_PLATFORMS = frozenset(["other"])  # We don't know what's in the event
# Event platforms corresponding to project platforms which were backfilled before we started
# blocking events with more than `MAX_FRAME_COUNT` frames from being sent to Seer (which we do to
# prevent possible over-grouping). Ultimately we want a more unified solution, but for now, we're
# just not going to apply the filter to events from these platforms.
EVENT_PLATFORMS_BYPASSING_FRAME_COUNT_CHECK = frozenset(
    [
        "go",
        "javascript",
        "node",
        "php",
        "python",
        "ruby",
    ]
)
# Existing projects with these platforms shouldn't be backfilled and new projects with these
# platforms shouldn't have Seer enabled.
SEER_INELIGIBLE_PROJECT_PLATFORMS = frozenset(
    [
        # We have no clue what's in these projects
        "other",
        "",
        None,
    ]
)
BASE64_ENCODED_PREFIXES = [
    "data:text/html;base64",
    "data:text/javascript;base64",
    "html;base64",
    "javascript;base64",
]


class ReferrerOptions(StrEnum):
    INGEST = "ingest"
    BACKFILL = "backfill"
    DELETION = "deletion"
    SIMILAR_ISSUES_TAB = "similar_issues_tab"


class TooManyOnlySystemFramesException(Exception):
    pass


def _get_value_if_exists(exception_value: Mapping[str, Any]) -> str:
    return exception_value["values"][0] if exception_value.get("values") else ""


class FramesMetrics(TypedDict):
    frame_count: int
    html_frame_count: int  # for a temporary metric
    has_no_filename: bool  # for a temporary metric
    is_frames_truncated: bool
    found_non_snipped_context_line: bool


def get_stacktrace_string(data: dict[str, Any], platform: str | None = None) -> str:
    """Format a stacktrace string from the grouping information."""
    app_hash = get_path(data, "app", "hash")
    app_component = get_path(data, "app", "component", "values")
    system_hash = get_path(data, "system", "hash")
    system_component = get_path(data, "system", "component", "values")

    if not (app_hash or system_hash):
        return ""

    # Get the data used for grouping
    if app_hash:
        exceptions = app_component
    else:
        exceptions = system_component

    # Handle chained exceptions
    if exceptions and exceptions[0].get("id") == "chained-exception":
        exceptions = exceptions[0].get("values")

    metrics.distribution("seer.grouping.exceptions.length", len(exceptions))

    frame_metrics: FramesMetrics = {
        "frame_count": 0,
        "html_frame_count": 0,  # for a temporary metric
        "has_no_filename": False,  # for a temporary metric
        "is_frames_truncated": False,
        "found_non_snipped_context_line": False,
    }

    result_parts = []

    # Reverse the list of exceptions in order to prioritize the outermost/most recent ones in cases
    # where there are chained exceptions and we end up truncating
    # Limit the number of chained exceptions
    for exception in reversed(exceptions[-MAX_EXCEPTION_COUNT:]):
        exception_type = exception.get("id")
        if not exception.get("contributes") or exception_type not in [
            "exception",
            "threads",
            "stacktrace",
        ]:
            continue

        exc_type, exc_value, frame_strings, frame_metrics = process_exception_frames(
            exception, frame_metrics
        )
        if (
            platform not in EVENT_PLATFORMS_BYPASSING_FRAME_COUNT_CHECK
            and frame_metrics["is_frames_truncated"]
        ):
            raise TooManyOnlySystemFramesException

        # Only exceptions have the type and value properties, so we don't need to handle the threads
        # case here
        header = f"{exc_type}: {exc_value}\n" if exception["id"] == "exception" else ""

        result_parts.append((header, frame_strings))

    return generate_stacktrace_string(result_parts, frame_metrics)


def generate_stacktrace_string(
    result_parts: Sequence[tuple[str, list[str]]],
    frame_metrics: FramesMetrics,
) -> str:
    stacktrace_str = ""
    final_frame_count = 0

    for header, frame_strings in result_parts:
        # For performance reasons, if the entire stacktrace is made of minified frames, restrict the
        # result to include only the first 20 frames, since minified frames are significantly more
        # token-dense than non-minified ones
        if not frame_metrics["found_non_snipped_context_line"]:
            frame_strings = _discard_excess_frames(
                frame_strings, FULLY_MINIFIED_STACKTRACE_MAX_FRAME_COUNT, final_frame_count
            )
            final_frame_count += len(frame_strings)

        stacktrace_str += header + "".join(frame_strings)

    metrics.incr(
        "seer.grouping.html_in_stacktrace",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags={
            "html_frames": (
                "none"
                if frame_metrics["html_frame_count"] == 0
                else "all" if frame_metrics["html_frame_count"] == final_frame_count else "some"
            )
        },
    )

    # Return empty stacktrace for events with no header, only one frame and no filename
    # since this is too little info to group on
    if frame_metrics["has_no_filename"] and len(result_parts) == 1:
        header, frames = result_parts[0][0], result_parts[0][1]
        if header == "" and len(frames) == 1:
            stacktrace_str = ""

    return stacktrace_str.strip()


def process_exception_frames(
    exception: dict[str, Any], frame_metrics: FramesMetrics
) -> tuple[str, str, list[str], FramesMetrics]:
    # For each exception, extract its type, value, and up to limit number of stacktrace frames
    exc_type, exc_value = "", ""
    frame_strings: list[str] = []
    exception_type = exception.get("id")
    if exception_type == "stacktrace":
        frame_strings, frame_metrics = _process_frames(exception.get("values", []), frame_metrics)
    else:
        for exception_value in exception.get("values", []):
            if exception_value.get("id") == "type":
                exc_type = _get_value_if_exists(exception_value)
            elif exception_value.get("id") == "value":
                exc_value = _get_value_if_exists(exception_value)
            elif (
                exception_value.get("id") == "stacktrace"
                and frame_metrics["frame_count"] < MAX_FRAME_COUNT
            ):
                frame_strings, frame_metrics = _process_frames(
                    exception_value["values"], frame_metrics
                )

    return exc_type, exc_value, frame_strings, frame_metrics


def _process_frames(
    frames: list[dict[str, Any]], frame_metrics: FramesMetrics
) -> tuple[list[str], FramesMetrics]:
    frame_strings = []

    contributing_frames = [
        frame for frame in frames if frame.get("id") == "frame" and frame.get("contributes")
    ]
    if len(contributing_frames) + frame_metrics["frame_count"] > MAX_FRAME_COUNT:
        frame_metrics["is_frames_truncated"] = True
    contributing_frames = _discard_excess_frames(
        contributing_frames, MAX_FRAME_COUNT, frame_metrics["frame_count"]
    )
    frame_metrics["frame_count"] += len(contributing_frames)

    for frame in contributing_frames:
        frame_dict = extract_values_from_frame_values(frame.get("values", []))
        filename = extract_filename(frame_dict) or "None"

        if not _is_snipped_context_line(frame_dict["context-line"]):
            frame_metrics["found_non_snipped_context_line"] = True

        if not frame_dict["filename"]:
            frame_metrics["has_no_filename"] = True

        # Not an exhaustive list of tests we could run to detect HTML, but this is only
        # meant to be a temporary, quick-and-dirty metric
        # TODO: Don't let this, and the metric below, hang around forever. It's only to
        # help us get a sense of whether it's worthwhile trying to more accurately
        # detect, and then exclude, frames containing HTML
        if frame_dict["filename"].endswith("html") or "<html>" in frame_dict["context-line"]:
            frame_metrics["html_frame_count"] += 1

        if is_base64_encoded_frame(frame_dict):
            continue

        frame_strings.append(
            f'  File "{filename}", function {frame_dict["function"]}\n    {frame_dict["context-line"]}\n'
        )

    return frame_strings, frame_metrics


def extract_values_from_frame_values(values: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    frame_dict = {"filename": "", "function": "", "context-line": "", "module": ""}
    for frame_values in values:
        if frame_values.get("id") in frame_dict:
            frame_dict[frame_values["id"]] = _get_value_if_exists(frame_values)
    return frame_dict


def extract_filename(frame_dict: Mapping[str, Any]) -> str:
    """
    Extract the filename from the frame dictionary. Fallback to module if filename is not present.
    """
    filename = frame_dict["filename"]
    if filename == "" and frame_dict["module"] != "":
        filename = frame_dict["module"]
    return filename


def is_base64_encoded_frame(frame_dict: Mapping[str, Any]) -> bool:
    # We want to skip frames with base64 encoded filenames since they can be large
    # and not contain any usable information
    base64_encoded = False
    for base64_prefix in BASE64_ENCODED_PREFIXES:
        if frame_dict["filename"].startswith(base64_prefix):
            base64_encoded = True
            break
    return base64_encoded


def get_stacktrace_string_with_metrics(
    data: dict[str, Any], platform: str | None, referrer: ReferrerOptions
) -> str | None:
    stacktrace_string = None
    sample_rate = options.get("seer.similarity.metrics_sample_rate")
    try:
        stacktrace_string = get_stacktrace_string(data, platform)
    except TooManyOnlySystemFramesException:
        platform = platform if platform else "unknown"
        metrics.incr(
            "grouping.similarity.over_threshold_only_system_frames",
            sample_rate=sample_rate,
            tags={"platform": platform, "referrer": referrer},
        )
        if referrer == ReferrerOptions.INGEST:
            record_did_call_seer_metric(call_made=False, blocker="over-threshold-frames")
    except Exception:
        logger.exception("Unexpected exception in stacktrace string formatting")

    return stacktrace_string


def event_content_has_stacktrace(event: GroupEvent | Event) -> bool:
    # If an event has no stacktrace, there's no data for Seer to analyze, so no point in making the
    # API call. If we ever start analyzing message-only events, we'll need to add `event.title in
    # PLACEHOLDER_EVENT_TITLES` to this check.
    exception_stacktrace = get_path(event.data, "exception", "values", -1, "stacktrace", "frames")
    threads_stacktrace = get_path(event.data, "threads", "values", -1, "stacktrace", "frames")
    only_stacktrace = get_path(event.data, "stacktrace", "frames")
    return exception_stacktrace or threads_stacktrace or only_stacktrace


def record_did_call_seer_metric(*, call_made: bool, blocker: str) -> None:
    metrics.incr(
        "grouping.similarity.did_call_seer",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags={"call_made": call_made, "blocker": blocker},
    )


def killswitch_enabled(
    project_id: int | None,
    referrer: ReferrerOptions,
    event: GroupEvent | Event | None = None,
) -> bool:
    """
    Check both the global and similarity-specific Seer killswitches.
    """
    is_ingest = referrer == ReferrerOptions.INGEST
    logger_prefix = f"grouping.similarity.{referrer.value}"
    logger_extra = {"event_id": event.event_id if event else None, "project_id": project_id}

    if options.get("seer.global-killswitch.enabled"):
        logger.warning(
            f"{logger_prefix}.seer_global_killswitch_enabled",  # noqa
            extra=logger_extra,
        )
        if is_ingest:
            record_did_call_seer_metric(call_made=False, blocker="global-killswitch")

        return True

    if options.get("seer.similarity-killswitch.enabled"):
        logger.warning(
            f"{logger_prefix}.seer_similarity_killswitch_enabled",  # noqa
            extra=logger_extra,
        )
        if is_ingest:
            record_did_call_seer_metric(call_made=False, blocker="similarity-killswitch")

        return True

    if killswitch_matches_context(
        "seer.similarity.grouping_killswitch_projects", {"project_id": project_id}
    ):
        logger.warning(
            f"{logger_prefix}.seer_similarity_project_killswitch_enabled",  # noqa
            extra=logger_extra,
        )
        if is_ingest:
            record_did_call_seer_metric(call_made=False, blocker="project-killswitch")

        return True

    return False


def filter_null_from_string(string: str) -> str:
    """
    Filter out null bytes from string so that it can be saved in records table.
    """
    return string.replace("\x00", "")


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
    return context_line.startswith("{snip}") or context_line.endswith("{snip}")


def project_is_seer_eligible(project: Project) -> bool:
    """
    Return True if the project hasn't already been backfilled, is a Seer-eligible platform, and
    the feature is enabled in the region.
    """
    is_backfill_completed = project.get_option("sentry:similarity_backfill_completed")
    is_seer_eligible_platform = project.platform not in SEER_INELIGIBLE_PROJECT_PLATFORMS
    is_region_enabled = options.get("similarity.new_project_seer_grouping.enabled")

    return not is_backfill_completed and is_seer_eligible_platform and is_region_enabled

import logging
from enum import StrEnum
from typing import Any, TypeVar

from sentry import options
from sentry.eventstore.models import Event
from sentry.killswitches import killswitch_matches_context
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

MAX_FRAME_COUNT = 30
MAX_EXCEPTION_COUNT = 30
FULLY_MINIFIED_STACKTRACE_MAX_FRAME_COUNT = 20
SEER_ELIGIBLE_PLATFORMS_EVENTS = frozenset(
    [
        "go",
        "java",
        "javascript",
        "node",
        "php",
        "python",
        "ruby",
    ]
)
# An original set of platforms were backfilled allowing more than 30 system contributing frames
# being set to seer. Unfortunately, this can cause over grouping. We will need to reduce
# these set of platforms but for now we will blacklist them.
SYSTEM_FRAME_CHECK_BLACKLIST_PLATFORMS = frozenset(
    [
        "bun",
        "deno",
        "django",
        "go",
        "go-echo",
        "go-fasthttp",
        "go-fiber",
        "go-gin",
        "go-http",
        "go-iris",
        "go-martini",
        "go-negroni",
        "javascript",
        "javascript-angular",
        "javascript-angularjs",
        "javascript-astro",
        "javascript-backbone",
        "javascript-browser",
        "javascript-electron",
        "javascript-ember",
        "javascript-gatsby",
        "javascript-nextjs",
        "javascript-performance-onboarding-1-install",
        "javascript-performance-onboarding-2-configure",
        "javascript-performance-onboarding-3-verify",
        "javascript-react",
        "javascript-react-performance-onboarding-1-install",
        "javascript-react-performance-onboarding-2-configure",
        "javascript-react-performance-onboarding-3-verify",
        "javascript-react-with-error-monitoring",
        "javascript-react-with-error-monitoring-performance-and-replay",
        "javascript-remix",
        "javascript-replay-onboarding-1-install",
        "javascript-replay-onboarding-2-configure",
        "javascript-solid",
        "javascript-svelte",
        "javascript-sveltekit",
        "javascript-vue",
        "javascript-vue-with-error-monitoring",
        "node",
        "node-awslambda",
        "node-azurefunctions",
        "node-connect",
        "node-express",
        "node-fastify",
        "node-gcpfunctions",
        "node-hapi",
        "node-koa",
        "node-nestjs",
        "node-nodeawslambda",
        "node-nodegcpfunctions",
        "node-profiling-onboarding-0-alert",
        "node-profiling-onboarding-1-install",
        "node-profiling-onboarding-2-configure-performance",
        "node-profiling-onboarding-3-configure-profiling",
        "node-serverlesscloud",
        "PHP",
        "php",
        "php-laravel",
        "php-monolog",
        "php-symfony",
        "php-symfony2",
        "python",
        "python-aiohttp",
        "python-asgi",
        "python-awslambda",
        "python-azurefunctions",
        "python-bottle",
        "python-celery",
        "python-chalice",
        "python-django",
        "python-falcon",
        "python-fastapi",
        "python-flask",
        "python-gcpfunctions",
        "python-profiling-onboarding-0-alert",
        "python-profiling-onboarding-1-install",
        "python-profiling-onboarding-3-configure-profiling",
        "python-pylons",
        "python-pymongo",
        "python-pyramid",
        "python-pythonawslambda",
        "python-pythonazurefunctions",
        "python-pythongcpfunctions",
        "python-pythonserverless",
        "python-quart",
        "python-rq",
        "python-sanic",
        "python-serverless",
        "python-starlette",
        "python-tornado",
        "python-tryton",
        "python-wsgi",
        "react",
        "react-native",
        "react-native-tracing",
        "ruby",
        "ruby-rack",
        "ruby-rails",
    ]
)
SEER_ELIGIBLE_PLATFORMS = SYSTEM_FRAME_CHECK_BLACKLIST_PLATFORMS | frozenset(
    [
        "android",
        "android-profiling-onboarding-1-install",
        "android-profiling-onboarding-3-configure-profiling",
        "android-profiling-onboarding-4-upload",
        "dart",
        "flutter",
        "groovy",
        "java",
        "java-android",
        "java-appengine",
        "java-log4j",
        "java-log4j2",
        "java-logging",
        "java-logback",
        "java-spring",
        "java-spring-boot",
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


class TooManyOnlySystemFramesException(Exception):
    pass


class NoFilenameOrModuleException(Exception):
    pass


def _get_value_if_exists(exception_value: dict[str, Any]) -> str:
    return exception_value["values"][0] if exception_value.get("values") else ""


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

    frame_count = 0
    html_frame_count = 0  # for a temporary metric
    is_frames_truncated = False
    has_no_filename_or_module = False
    stacktrace_str = ""
    found_non_snipped_context_line = False

    metrics.distribution("seer.grouping.exceptions.length", len(exceptions))

    def _process_frames(frames: list[dict[str, Any]]) -> list[str]:
        nonlocal frame_count
        nonlocal html_frame_count
        nonlocal is_frames_truncated
        nonlocal has_no_filename_or_module
        nonlocal found_non_snipped_context_line
        frame_strings = []

        contributing_frames = [
            frame for frame in frames if frame.get("id") == "frame" and frame.get("contributes")
        ]
        if len(contributing_frames) + frame_count > MAX_FRAME_COUNT:
            is_frames_truncated = True
        contributing_frames = _discard_excess_frames(
            contributing_frames, MAX_FRAME_COUNT, frame_count
        )
        frame_count += len(contributing_frames)

        for frame in contributing_frames:
            frame_dict = {"filename": "", "function": "", "context-line": "", "module": ""}
            for frame_values in frame.get("values", []):
                if frame_values.get("id") in frame_dict:
                    frame_dict[frame_values["id"]] = _get_value_if_exists(frame_values)

            if not _is_snipped_context_line(frame_dict["context-line"]):
                found_non_snipped_context_line = True

            if frame_dict["filename"] == "" and frame_dict["module"] == "":
                has_no_filename_or_module = True
            elif frame_dict["filename"] == "":
                frame_dict["filename"] = frame_dict["module"]

            # Not an exhaustive list of tests we could run to detect HTML, but this is only
            # meant to be a temporary, quick-and-dirty metric
            # TODO: Don't let this, and the metric below, hang around forever. It's only to
            # help us get a sense of whether it's worthwhile trying to more accurately
            # detect, and then exclude, frames containing HTML
            if frame_dict["filename"].endswith("html") or "<html>" in frame_dict["context-line"]:
                html_frame_count += 1

            # We want to skip frames with base64 encoded filenames since they can be large
            # and not contain any usable information
            base64_encoded = False
            for base64_prefix in BASE64_ENCODED_PREFIXES:
                if frame_dict["filename"].startswith(base64_prefix):
                    base64_encoded = True
                    break
            if base64_encoded:
                continue

            frame_strings.append(
                f'  File "{frame_dict["filename"]}", function {frame_dict["function"]}\n    {frame_dict["context-line"]}\n'
            )

        return frame_strings

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

        # For each exception, extract its type, value, and up to limit number of stacktrace frames
        exc_type, exc_value, frame_strings = "", "", []
        if exception_type == "stacktrace":
            frame_strings = _process_frames(exception.get("values", []))
        else:
            for exception_value in exception.get("values", []):
                if exception_value.get("id") == "type":
                    exc_type = _get_value_if_exists(exception_value)
                elif exception_value.get("id") == "value":
                    exc_value = _get_value_if_exists(exception_value)
                elif exception_value.get("id") == "stacktrace" and frame_count < MAX_FRAME_COUNT:
                    frame_strings = _process_frames(exception_value["values"])
        if (
            platform not in SYSTEM_FRAME_CHECK_BLACKLIST_PLATFORMS
            and is_frames_truncated
            and not app_hash
        ):
            raise TooManyOnlySystemFramesException
        if has_no_filename_or_module:
            raise NoFilenameOrModuleException
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

    metrics.incr(
        "seer.grouping.html_in_stacktrace",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags={
            "html_frames": (
                "none"
                if html_frame_count == 0
                else "all" if html_frame_count == final_frame_count else "some"
            )
        },
    )

    return stacktrace_str.strip()


def get_stacktrace_string_with_metrics(
    data: dict[str, Any], platform: str | None, referrer: ReferrerOptions
) -> str | None:
    try:
        stacktrace_string = get_stacktrace_string(data, platform)
    except TooManyOnlySystemFramesException:
        platform = platform if platform else "unknown"
        metrics.incr(
            "grouping.similarity.over_threshold_only_system_frames",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"platform": platform, "referrer": referrer},
        )
        if referrer == ReferrerOptions.INGEST:
            metrics.incr(
                "grouping.similarity.did_call_seer",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={
                    "call_made": False,
                    "blocker": "over-threshold-only-system-frames",
                },
            )
        stacktrace_string = None
    except NoFilenameOrModuleException:
        if referrer == ReferrerOptions.INGEST:
            metrics.incr(
                "grouping.similarity.did_call_seer",
                sample_rate=options.get("seer.similarity.metrics_sample_rate"),
                tags={
                    "call_made": False,
                    "blocker": "no-module-or-filename",
                },
            )
        stacktrace_string = None
    return stacktrace_string


def event_content_has_stacktrace(event: Event) -> bool:
    # If an event has no stacktrace, there's no data for Seer to analyze, so no point in making the
    # API call. If we ever start analyzing message-only events, we'll need to add `event.title in
    # PLACEHOLDER_EVENT_TITLES` to this check.
    exception_stacktrace = get_path(event.data, "exception", "values", -1, "stacktrace", "frames")
    threads_stacktrace = get_path(event.data, "threads", "values", -1, "stacktrace", "frames")
    only_stacktrace = get_path(event.data, "stacktrace", "frames")
    return exception_stacktrace or threads_stacktrace or only_stacktrace


def event_content_is_seer_eligible(event: Event) -> bool:
    """
    Determine if an event's contents makes it fit for using with Seer's similar issues model.
    """
    # TODO: Determine if we want to filter out non-sourcemapped events
    if not event_content_has_stacktrace(event):
        metrics.incr(
            "grouping.similarity.event_content_seer_eligible",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"eligible": False, "blocker": "no-stacktrace"},
        )
        return False

    if event.platform not in SEER_ELIGIBLE_PLATFORMS_EVENTS:
        metrics.incr(
            "grouping.similarity.event_content_seer_eligible",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"eligible": False, "blocker": "unsupported-platform"},
        )
        return False

    metrics.incr(
        "grouping.similarity.event_content_seer_eligible",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        tags={"eligible": True, "blocker": "none"},
    )
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
        metrics.incr(
            "grouping.similarity.did_call_seer",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"call_made": False, "blocker": "global-killswitch"},
        )
        return True

    if options.get("seer.similarity-killswitch.enabled"):
        logger.warning(
            "should_call_seer_for_grouping.seer_similarity_killswitch_enabled",
            extra=logger_extra,
        )
        metrics.incr(
            "grouping.similarity.did_call_seer",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"call_made": False, "blocker": "similarity-killswitch"},
        )
        return True

    if killswitch_matches_context(
        "seer.similarity.grouping_killswitch_projects", {"project_id": project_id}
    ):
        logger.warning(
            "should_call_seer_for_grouping.seer_similarity_project_killswitch_enabled",
            extra=logger_extra,
        )
        metrics.incr(
            "grouping.similarity.did_call_seer",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
            tags={"call_made": False, "blocker": "project-killswitch"},
        )
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
    is_seer_eligible_platform = project.platform in SEER_ELIGIBLE_PLATFORMS
    is_region_enabled = options.get("similarity.new_project_seer_grouping.enabled")

    return not is_backfill_completed and is_seer_eligible_platform and is_region_enabled

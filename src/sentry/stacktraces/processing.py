import logging
from collections import OrderedDict, namedtuple
from datetime import datetime

import sentry_sdk
from django.utils import timezone

from sentry.models import Project, Release
from sentry.stacktraces.functions import set_in_app, trim_function_name
from sentry.utils.cache import cache
from sentry.utils.hashlib import hash_values
from sentry.utils.safe import get_path, safe_execute

logger = logging.getLogger(__name__)

StacktraceInfo = namedtuple(
    "StacktraceInfo", ["stacktrace", "container", "platforms", "is_exception"]
)
StacktraceInfo.__hash__ = lambda x: id(x)
StacktraceInfo.__eq__ = lambda a, b: a is b
StacktraceInfo.__ne__ = lambda a, b: a is not b


class ProcessableFrame:
    def __init__(self, frame, idx, processor, stacktrace_info, processable_frames):
        self.frame = frame
        self.idx = idx
        self.processor = processor
        self.stacktrace_info = stacktrace_info
        self.data = None
        self.cache_key = None
        self.cache_value = None
        self.processable_frames = processable_frames

    def __repr__(self):
        return "<ProcessableFrame {!r} #{!r} at {!r}>".format(
            self.frame.get("function") or "unknown",
            self.idx,
            self.frame.get("instruction_addr"),
        )

    def __contains__(self, key):
        return key in self.frame

    def __getitem__(self, key):
        return self.frame[key]

    def get(self, key, default=None):
        return self.frame.get(key, default)

    def close(self):
        # manually break circular references
        self.closed = True
        self.processable_frames = None
        self.stacktrace_info = None
        self.processor = None

    @property
    def previous_frame(self):
        last_idx = len(self.processable_frames) - self.idx - 1 - 1
        if last_idx < 0:
            return
        return self.processable_frames[last_idx]

    def set_cache_value(self, value):
        if self.cache_key is not None:
            cache.set(self.cache_key, value, 3600)
            return True
        return False

    def set_cache_key_from_values(self, values):
        if values is None:
            self.cache_key = None
            return

        h = hash_values(values, seed=self.processor.__class__.__name__)
        self.cache_key = rv = "pf:%s" % h
        return rv


class StacktraceProcessingTask:
    def __init__(self, processable_stacktraces, processors):
        self.processable_stacktraces = processable_stacktraces
        self.processors = processors

    def close(self):
        for frame in self.iter_processable_frames():
            frame.close()

    def iter_processors(self):
        return iter(self.processors)

    def iter_processable_stacktraces(self):
        return self.processable_stacktraces.items()

    def iter_processable_frames(self, processor=None):
        for _, frames in self.iter_processable_stacktraces():
            for frame in frames:
                if processor is None or frame.processor == processor:
                    yield frame


class StacktraceProcessor:
    def __init__(self, data, stacktrace_infos, project=None):
        self.data = data
        self.stacktrace_infos = stacktrace_infos
        if project is None:
            project = Project.objects.get_from_cache(id=data["project"])
        self.project = project

    def close(self):
        pass

    def get_release(self, create=False):
        """Convenient helper to return the release for the current data
        and optionally creates the release if it's missing.  In case there
        is no release info it will return `None`.
        """
        release = self.data.get("release")
        if not release:
            return None
        if not create:
            return Release.get(project=self.project, version=self.data["release"])
        timestamp = self.data.get("timestamp")
        if timestamp is not None:
            date = datetime.fromtimestamp(timestamp).replace(tzinfo=timezone.utc)
        else:
            date = None
        return Release.get_or_create(
            project=self.project, version=self.data["release"], date_added=date
        )

    def handles_frame(self, frame, stacktrace_info):
        """Returns true if this processor can handle this frame.  This is the
        earliest check and operates on a raw frame and stacktrace info.  If
        this returns `True` a processable frame is created.
        """
        return False

    def preprocess_frame(self, processable_frame):
        """After a processable frame has been created this method is invoked
        to give the processor a chance to store additional data to the frame
        if wanted.  In particular a cache key can be set here.
        """

    def process_exception(self, exception):
        """Processes an exception."""
        return False

    def process_frame(self, processable_frame, processing_task):
        """Processes the processable frame and returns a tuple of three
        lists: ``(frames, raw_frames, errors)`` where frames is the list of
        processed frames, raw_frames is the list of raw unprocessed frames
        (which however can also be modified if needed) as well as a list of
        optional errors.  Each one of the items can be `None` in which case
        the original input frame is assumed.
        """

    def preprocess_step(self, processing_task):
        """After frames are preprocessed but before frame processing kicks in
        the preprocessing step is run.  This already has access to the cache
        values on the frames.
        """
        return False


def find_stacktraces_in_data(data, include_raw=False, with_exceptions=False):
    """Finds all stracktraces in a given data blob and returns it
    together with some meta information.

    If `include_raw` is True, then also raw stacktraces are included.  If
    `with_exceptions` is set to `True` then stacktraces of the exception
    are always included and the `is_exception` flag is set on that stack
    info object.
    """
    rv = []

    def _report_stack(stacktrace, container, is_exception=False):
        if not is_exception and (not stacktrace or not get_path(stacktrace, "frames", filter=True)):
            return

        platforms = {
            frame.get("platform") or data.get("platform")
            for frame in get_path(stacktrace, "frames", filter=True, default=())
        }
        rv.append(
            StacktraceInfo(
                stacktrace=stacktrace,
                container=container,
                platforms=platforms,
                is_exception=is_exception,
            )
        )

    for exc in get_path(data, "exception", "values", filter=True, default=()):
        _report_stack(exc.get("stacktrace"), exc, is_exception=with_exceptions)

    _report_stack(data.get("stacktrace"), None)

    for thread in get_path(data, "threads", "values", filter=True, default=()):
        _report_stack(thread.get("stacktrace"), thread)

    if include_raw:
        for info in rv[:]:
            if info.container is not None:
                _report_stack(info.container.get("raw_stacktrace"), info.container)

    return rv


def _has_system_frames(frames):
    """
    Determines whether there are any frames in the stacktrace with in_app=false.
    """

    system_frames = 0
    for frame in frames:
        if not frame.get("in_app"):
            system_frames += 1
    return bool(system_frames) and len(frames) != system_frames


def _normalize_in_app(stacktrace):
    """
    Ensures consistent values of in_app across a stacktrace.
    """
    # Default to false in all cases where processors or grouping enhancers
    # have not yet set in_app.
    for frame in stacktrace:
        if frame.get("in_app") is None:
            set_in_app(frame, False)


def normalize_stacktraces_for_grouping(data, grouping_config=None):
    """
    Applies grouping enhancement rules and ensure in_app is set on all frames.
    This also trims functions if necessary.
    """

    stacktraces = []
    stacktrace_exceptions = []

    for stacktrace_info in find_stacktraces_in_data(data, include_raw=True):
        frames = get_path(stacktrace_info.stacktrace, "frames", filter=True, default=())
        if frames:
            stacktraces.append(frames)
            stacktrace_exceptions.append(
                stacktrace_info.container if stacktrace_info.is_exception else None
            )

    if not stacktraces:
        return

    platform = data.get("platform")

    # Put the trimmed function names into the frames.  We only do this if
    # the trimming produces a different function than the function we have
    # otherwise stored in `function` to not make the payload larger
    # unnecessarily.
    for frames in stacktraces:
        for frame in frames:
            # Restore the original in_app value before the first grouping
            # enhancers have been run. This allows to re-apply grouping
            # enhancers on the original frame data.
            orig_in_app = get_path(frame, "data", "orig_in_app")
            if orig_in_app is not None:
                frame["in_app"] = None if orig_in_app == -1 else bool(orig_in_app)

            if frame.get("raw_function") is not None:
                continue
            raw_func = frame.get("function")
            if not raw_func:
                continue
            function_name = trim_function_name(raw_func, frame.get("platform") or platform)
            if function_name != raw_func:
                frame["raw_function"] = raw_func
                frame["function"] = function_name

    # If a grouping config is available, run grouping enhancers
    if grouping_config is not None:
        for frames, exception_data in zip(stacktraces, stacktrace_exceptions):
            grouping_config.enhancements.apply_modifications_to_frame(
                frames, platform, exception_data
            )

    # normalize in-app
    for stacktrace in stacktraces:
        _normalize_in_app(stacktrace)


def should_process_for_stacktraces(data):
    from sentry.plugins.base import plugins

    infos = find_stacktraces_in_data(data, with_exceptions=True)
    platforms = set()
    for info in infos:
        platforms.update(info.platforms or ())
    for plugin in plugins.all(version=2):
        processors = safe_execute(
            plugin.get_stacktrace_processors,
            data=data,
            stacktrace_infos=infos,
            platforms=platforms,
            _with_transaction=False,
        )
        if processors:
            return True
    return False


def get_processors_for_stacktraces(data, infos):
    from sentry.plugins.base import plugins

    platforms = set()
    for info in infos:
        platforms.update(info.platforms or ())

    processors = []
    for plugin in plugins.all(version=2):
        processors.extend(
            safe_execute(
                plugin.get_stacktrace_processors,
                data=data,
                stacktrace_infos=infos,
                platforms=platforms,
                _with_transaction=False,
            )
            or ()
        )

    if processors:
        project = Project.objects.get_from_cache(id=data["project"])
        processors = [x(data, infos, project) for x in processors]

    return processors


def get_processable_frames(stacktrace_info, processors):
    """Returns thin wrappers around the frames in a stacktrace associated
    with the processor for it.
    """
    frames = get_path(stacktrace_info.stacktrace, "frames", filter=True, default=())
    frame_count = len(frames)
    rv = []
    for idx, frame in enumerate(frames):
        processor = next((p for p in processors if p.handles_frame(frame, stacktrace_info)), None)
        if processor is not None:
            rv.append(
                ProcessableFrame(frame, frame_count - idx - 1, processor, stacktrace_info, rv)
            )
    return rv


def process_single_stacktrace(processing_task, stacktrace_info, processable_frames):
    # TODO: associate errors with the frames and processing issues
    changed_raw = False
    changed_processed = False
    raw_frames = []
    processed_frames = []
    all_errors = []

    bare_frames = get_path(stacktrace_info.stacktrace, "frames", filter=True, default=())
    frame_count = len(bare_frames)
    processable_frames = {frame.idx: frame for frame in processable_frames}

    for i, bare_frame in enumerate(bare_frames):
        idx = frame_count - i - 1
        rv = None

        if idx in processable_frames:
            processable_frame = processable_frames[idx]
            assert processable_frame.frame is bare_frame
            try:
                rv = processable_frame.processor.process_frame(processable_frame, processing_task)
            except Exception:
                logger.exception("Failed to process frame")

        expand_processed, expand_raw, errors = rv or (None, None, None)

        if expand_processed is not None:
            processed_frames.extend(expand_processed)
            changed_processed = True
        elif expand_raw:  # is not empty
            processed_frames.extend(expand_raw)
            changed_processed = True
        else:
            processed_frames.append(bare_frame)

        if expand_raw is not None:
            raw_frames.extend(expand_raw)
            changed_raw = True
        else:
            raw_frames.append(bare_frame)
        all_errors.extend(errors or ())

    return (
        processed_frames if changed_processed else None,
        raw_frames if changed_raw else None,
        all_errors,
    )


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


def lookup_frame_cache(keys):
    rv = {}
    for key in keys:
        rv[key] = cache.get(key)
    return rv


def get_stacktrace_processing_task(infos, processors):
    """Returns a list of all tasks for the processors.  This can skip over
    processors that seem to not handle any frames.
    """
    by_processor = {}
    to_lookup = {}

    # by_stacktrace_info requires stable sorting as it is used in
    # StacktraceProcessingTask.iter_processable_stacktraces. This is important
    # to guarantee reproducible symbolicator requests.
    by_stacktrace_info = OrderedDict()

    for info in infos:
        processable_frames = get_processable_frames(info, processors)
        for processable_frame in processable_frames:
            processable_frame.processor.preprocess_frame(processable_frame)
            by_processor.setdefault(processable_frame.processor, []).append(processable_frame)
            by_stacktrace_info.setdefault(processable_frame.stacktrace_info, []).append(
                processable_frame
            )
            if processable_frame.cache_key is not None:
                to_lookup[processable_frame.cache_key] = processable_frame

    frame_cache = lookup_frame_cache(to_lookup)
    for cache_key, processable_frame in to_lookup.items():
        processable_frame.cache_value = frame_cache.get(cache_key)

    return StacktraceProcessingTask(
        processable_stacktraces=by_stacktrace_info, processors=by_processor
    )


def dedup_errors(errors):
    # This operation scales bad but we do not expect that many items to
    # end up in rv, so that should be okay enough to do.
    rv = []
    for error in errors:
        if error not in rv:
            rv.append(error)
    return rv


def process_stacktraces(data, make_processors=None, set_raw_stacktrace=True):
    infos = find_stacktraces_in_data(data, with_exceptions=True)
    if make_processors is None:
        processors = get_processors_for_stacktraces(data, infos)
    else:
        processors = make_processors(data, infos)

    # Early out if we have no processors.  We don't want to record a timer
    # in that case.
    if not processors:
        return

    changed = False

    # Build a new processing task
    processing_task = get_stacktrace_processing_task(infos, processors)
    try:

        # Preprocess step
        for processor in processing_task.iter_processors():
            with sentry_sdk.start_span(
                op="stacktraces.processing.process_stacktraces.preprocess_step"
            ) as span:
                span.set_data("processor", processor.__class__.__name__)
                if processor.preprocess_step(processing_task):
                    changed = True
                    span.set_data("data_changed", True)

        # Process all stacktraces
        for stacktrace_info, processable_frames in processing_task.iter_processable_stacktraces():
            # Let the stacktrace processors touch the exception
            if stacktrace_info.is_exception and stacktrace_info.container:
                for processor in processing_task.iter_processors():
                    with sentry_sdk.start_span(
                        op="stacktraces.processing.process_stacktraces.process_exception"
                    ) as span:
                        span.set_data("processor", processor.__class__.__name__)
                        if processor.process_exception(stacktrace_info.container):
                            changed = True
                            span.set_data("data_changed", True)

            # If the stacktrace is empty we skip it for processing
            if not stacktrace_info.stacktrace:
                continue
            with sentry_sdk.start_span(
                op="stacktraces.processing.process_stacktraces.process_single_stacktrace"
            ) as span:
                new_frames, new_raw_frames, errors = process_single_stacktrace(
                    processing_task, stacktrace_info, processable_frames
                )
                if new_frames is not None:
                    stacktrace_info.stacktrace["frames"] = new_frames
                    changed = True
                    span.set_data("data_changed", True)
            if (
                set_raw_stacktrace
                and new_raw_frames is not None
                and stacktrace_info.container is not None
            ):
                stacktrace_info.container["raw_stacktrace"] = dict(
                    stacktrace_info.stacktrace, frames=new_raw_frames
                )
                changed = True
            if errors:
                data.setdefault("errors", []).extend(dedup_errors(errors))
                data.setdefault("_metrics", {})["flag.processing.error"] = True
                changed = True

    except Exception:
        logger.exception("stacktraces.processing.crash")
        data.setdefault("_metrics", {})["flag.processing.fatal"] = True
        data.setdefault("_metrics", {})["flag.processing.error"] = True
        changed = True
    finally:
        for processor in processors:
            processor.close()
        processing_task.close()

    if changed:
        return data

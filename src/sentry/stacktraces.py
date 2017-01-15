from __future__ import absolute_import

import logging

from sentry.models import Project
from sentry.utils.safe import safe_execute


logger = logging.getLogger(__name__)


class StacktraceInfo(object):
    """A wrapper around a stacktrace that was extracted from event
    data.
    """

    def __init__(self, stacktrace, container=None, platforms=None):
        self.stacktrace = stacktrace
        self.container = container
        self.platforms = platforms


class StacktraceProcessor(object):

    def __init__(self, data, stacktrace_infos):
        self.data = data
        self.stacktrace_infos = stacktrace_infos
        self.project = Project.objects.get_from_cache(
            id=data['project']
        )

    def close(self):
        pass

    def get_effective_platform(self, frame):
        return frame.get('platform') or self.data['platform']

    def process_frame(self, frame):
        pass


class FrameError(object):

    def __init__(self, type=None, key=None, data=None,
                 record_processing_issue=False, release_bound=True):
        self.type = type
        self.key = key
        self.data = data
        self.record_processing_issue = record_processing_issue
        self.release_bound = release_bound


def find_stacktraces_in_data(data):
    """Finds all stracktraces in a given data blob and returns it
    together with some meta information.
    """
    rv = []

    def _report_stack(stacktrace, container):
        platforms = set()
        for frame in stacktrace.get('frames') or ():
            platforms.add(frame.get('platform') or data['platform'])
        rv.append(StacktraceInfo(
            stacktrace=stacktrace,
            container=container,
            platforms=platforms
        ))

    exc_container = data.get('sentry.interfaces.Exception')
    if exc_container:
        for exc in exc_container['values']:
            stacktrace = exc.get('stacktrace')
            if stacktrace:
                _report_stack(stacktrace, exc)

    stacktrace = data.get('sentry.interfaces.Stacktrace')
    if stacktrace:
        _report_stack(stacktrace, None)

    threads = data.get('threads')
    if threads:
        for thread in threads['values']:
            stacktrace = thread.get('stacktrace')
            if stacktrace:
                _report_stack(stacktrace, thread)

    return rv


def get_processors_for_stacktraces(data, infos):
    from sentry.plugins import plugins

    platforms = set()
    for info in infos:
        platforms.update(info.platforms or ())

    processors = []
    for plugin in plugins.all(version=2):
        processors.extend(safe_execute(plugin.get_stacktrace_processors,
                                       data=data, stacktrace_infos=infos,
                                       platforms=platforms,
                                       _with_transaction=False) or ())

    return processors


def process_single_stacktrace(stacktrace_info, processors):
    # TODO: associate errors with the frames and processing issues
    changed_raw = False
    changed_processed = False
    raw_frames = []
    processed_frames = []
    all_errors = []

    for frame in stacktrace_info.stacktrace['frames']:
        need_processed_frame = True
        need_raw_frame = True
        errors = None
        for processor in processors:
            try:
                rv = processor.process_frame(frame) or None, None, None
            except Exception:
                logger.exception('Failed to process frame')
                continue

            expand_processed, expand_raw, errors = rv
            if expand_processed is not None:
                processed_frames.extend(expand_processed)
                changed_processed = True
                need_processed_frame = False

            if expand_raw is not None:
                raw_frames.extend(expand_raw)
                changed_raw = True
                need_raw_frame = False

            break

        if need_processed_frame:
            processed_frames.append(frame)
        if need_raw_frame:
            raw_frames.append(frame)
        all_errors.extend(errors or ())

    return (
        dict(stacktrace_info.stacktrace,
             frames=processed_frames) if changed_processed else None,
        dict(stacktrace_info.stacktrace,
             frames=raw_frames) if changed_raw else None,
        all_errors,
    )


def process_stacktraces(data):
    infos = find_stacktraces_in_data(data)
    processors = get_processors_for_stacktraces(data, infos)
    changed = False

    for stacktrace_info in infos:
        new_stacktrace, raw_stacktrace, errors = process_single_stacktrace(
            stacktrace_info, processors)
        if new_stacktrace is not None:
            stacktrace_info.stacktrace.clear()
            stacktrace_info.stacktrace.update(new_stacktrace)
            changed = True
        if raw_stacktrace is not None and \
           stacktrace_info.container is not None:
            stacktrace_info.container['raw_stacktrace'] = raw_stacktrace
            changed = True
        data.setdefault('errors', []).extend(errors or ())

    for processor in processors:
        processor.close()

    if changed:
        return data

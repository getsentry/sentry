from __future__ import absolute_import

import logging
import hashlib

from sentry.models import Project
from sentry.utils import metrics
from sentry.utils.safe import safe_execute
from collections import namedtuple
from six import integer_types


logger = logging.getLogger(__name__)


ProcessableFrame = namedtuple('ProcessableFrame', [
    'frame', 'idx', 'processor', 'stacktrace_info', 'cache_key'])
StacktraceInfo = namedtuple('StacktraceInfo', [
    'stacktrace', 'container', 'platforms'])


class StacktraceProcessor(object):

    def __init__(self, data, stacktrace_infos, project=None):
        self.data = data
        self.stacktrace_infos = stacktrace_infos
        if project is None:
            project = Project.objects.get_from_cache(id=data['project'])
        self.project = project

    def close(self):
        pass

    def get_frame_cache_attributes(self):
        return None

    def preprocess_related_data(self):
        return False

    def handles_frame(self, frame, stacktrace_info):
        return False

    def process_frame(self, processable_frame):
        pass


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


def should_process_for_stacktraces(data):
    from sentry.plugins import plugins
    infos = find_stacktraces_in_data(data)
    platforms = set()
    for info in infos:
        platforms.update(info.platforms or ())
    for plugin in plugins.all(version=2):
        processors = safe_execute(plugin.get_stacktrace_processors,
                                  data=data, stacktrace_infos=infos,
                                  platforms=platforms,
                                  _with_transaction=False)
        if processors:
            return True
    return False


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

    if processors:
        project = Project.objects.get_from_cache(id=data['project'])
        processors = [x(data, infos, project) for x in processors]

    return processors


def _get_frame_cache_key(processor, frame):
    attributes = processor.get_frame_cache_attributes(frame)
    if attributes is None:
        return None

    h = hashlib.md5()

    def _hash_value(value):
        if value is None:
            h.update(b'\x00')
        elif value is True:
            h.update(b'\x01')
        elif value is False:
            h.update(b'\x02')
        elif isinstance(value, integer_types):
            h.update(str(value).encode('ascii') + b'\x00')

    for attr_name in attributes:
        value = frame.get(attr_name)
        h.update(attr_name.encode('ascii') + b'\x00')
        _hash_value(value)

    return h.hexdigest()


def get_processable_frames(stacktrace_info, processors):
    frame_count = len(stacktrace_info.stacktrace['frames'])
    rv = []
    for idx, frame in enumerate(stacktrace_info.stacktrace['frames']):
        processor = next((p for p in processors
                          if p.handles_frame(frame, stacktrace_info)), None)
        if processor is not None:
            rv.append(ProcessableFrame(
                frame, frame_count - idx - 1, processor,
                stacktrace_info, _get_frame_cache_key(processor, frame)))
    return rv


def process_single_stacktrace(stacktrace_info, processors):
    # TODO: associate errors with the frames and processing issues
    changed_raw = False
    changed_processed = False
    raw_frames = []
    processed_frames = []
    all_errors = []

    processable_frames = get_processable_frames(stacktrace_info, processors)

    for processable_frame in processable_frames:
        try:
            rv = processable_frame.processor.process_frame(processable_frame)
        except Exception:
            logger.exception('Failed to process frame')
        expand_processed, expand_raw, errors = rv or (None, None, None)

        if expand_processed is not None:
            processed_frames.extend(expand_processed)
            changed_processed = True
        else:
            processed_frames.append(processable_frame.frame)

        if expand_raw is not None:
            raw_frames.extend(expand_raw)
            changed_raw = True
        else:
            raw_frames.append(processable_frame.frame)
        all_errors.extend(errors or ())

    return (
        dict(stacktrace_info.stacktrace,
             frames=processed_frames) if changed_processed else None,
        dict(stacktrace_info.stacktrace,
             frames=raw_frames) if changed_raw else None,
        all_errors,
    )


def get_metrics_key(stacktrace_infos):
    platforms = set()
    for info in stacktrace_infos:
        platforms.update(info.platforms)

    if len(platforms) == 1:
        platform = next(iter(platforms))
        if platform == 'javascript':
            return 'sourcemaps.process'
        if platform == 'cocoa':
            return 'dsym.process'
    return 'mixed.process'


def process_stacktraces(data, make_processors=None):
    infos = find_stacktraces_in_data(data)
    if make_processors is None:
        processors = get_processors_for_stacktraces(data, infos)
    else:
        processors = make_processors(data, infos)

    # Early out if we have no processors.  We don't want to record a timer
    # in that case.
    if not processors:
        return

    changed = False

    mkey = get_metrics_key(infos)

    with metrics.timer(mkey, instance=data['project']):
        for processor in processors:
            if processor.preprocess_related_data():
                changed = True

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
            if errors:
                data.setdefault('errors', []).extend(errors)
                changed = True

        for processor in processors:
            processor.close()

    if changed:
        return data

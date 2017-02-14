from __future__ import absolute_import

import logging
import hashlib

from collections import namedtuple

from django.core.cache import cache

from sentry.models import Project
from sentry.utils import metrics
from sentry.utils.safe import safe_execute

import six
from six import integer_types, text_type


logger = logging.getLogger(__name__)


ProcessableFrame = namedtuple('ProcessableFrame', [
    'frame', 'idx', 'processor', 'stacktrace_info', 'cache_key'])
StacktraceInfo = namedtuple('StacktraceInfo', [
    'stacktrace', 'container', 'platforms'])


class StacktraceProcessingTask(object):

    def __init__(self, processable_stacktraces, frame_cache, processors):
        self.processable_stacktraces = processable_stacktraces
        self.frame_cache = frame_cache
        self.processors = processors

    def iter_processors(self):
        return iter(self.processors)

    def iter_processable_stacktraces(self):
        return six.iteritems(self.processable_stacktraces)

    def get_frame_cache_data(self, processing_frame):
        if processing_frame.cache_key:
            return self.frame_cache.get(processing_frame.cache_key)

    def set_frame_cache_data(self, processing_frame, value):
        if processing_frame.cache_key:
            cache.set(processing_frame.cache_key, value, 3600)


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

    def get_frame_cache_values(self, frame):
        attributes = self.get_frame_cache_attributes()
        if attributes is not None:
            return [(attr, frame.get(attr)) for attr in attributes]

    def preprocess_related_data(self, processing_task):
        return False

    def handles_frame(self, frame, stacktrace_info):
        return False

    def process_frame(self, processable_frame, processing_task):
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
    values = processor.get_frame_cache_values(frame)
    if values is None:
        return None

    h = hashlib.md5()
    h.update((u'%s\xff' % processor.__class__.__name__).encode('utf-8'))

    def _hash_value(value):
        if value is None:
            h.update(b'\x00')
        elif value is True:
            h.update(b'\x01')
        elif value is False:
            h.update(b'\x02')
        elif isinstance(value, integer_types):
            h.update(b'\x03' + text_type(value).encode('ascii') + b'\x00')
        elif isinstance(value, (tuple, list)):
            h.update(b'\x04' + text_type(len(value)).encode('utf-8'))
            for item in value:
                _hash_value(item)
        elif isinstance(value, dict):
            h.update(b'\x05' + text_type(len(value)).encode('utf-8'))
            for k, v in six.iteritems(value):
                _hash_value(k)
                _hash_value(v)
        elif isinstance(value, bytes):
            h.update(b'\x06' + value + b'\x00')
        elif isinstance(value, text_type):
            h.update(b'\x07' + value.encode('utf-8') + b'\x00')
        else:
            raise TypeError('Invalid value for frame cache')

    for attr_name, value in values:
        h.update((u'\xff%s|' % attr_name).encode('utf-8'))
        value = frame.get(attr_name)
        h.update(attr_name.encode('ascii') + b'\x00')
        _hash_value(value)

    return h.hexdigest()


def get_processable_frames(stacktrace_info, processors):
    """Returns thin wrappers around the frames in a stacktrace associated
    with the processor for it.
    """
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


def process_single_stacktrace(processing_task, stacktrace_info,
                              processable_frames):
    # TODO: associate errors with the frames and processing issues
    changed_raw = False
    changed_processed = False
    raw_frames = []
    processed_frames = []
    all_errors = []

    for processable_frame in processable_frames:
        try:
            rv = processable_frame.processor.process_frame(
                processable_frame, processing_task)
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
        processed_frames if changed_processed else None,
        raw_frames if changed_raw else None,
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
    by_stacktrace_info = {}
    to_lookup = {}

    for info in infos:
        processable_frames = get_processable_frames(info, processors)
        for processable_frame in processable_frames:
            by_processor.setdefault(processable_frame.processor, []) \
                .append(processable_frame)
            by_stacktrace_info.setdefault(processable_frame.stacktrace_info, []) \
                .append(processable_frame)
            if processable_frame.cache_key is not None:
                to_lookup[processable_frame.cache_key] = processable_frame

    return StacktraceProcessingTask(
        processable_stacktraces=by_stacktrace_info,
        frame_cache=lookup_frame_cache(to_lookup),
        processors=by_processor
    )


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
        # Build a new processing task
        processing_task = get_stacktrace_processing_task(infos, processors)

        # Preprocess step
        for processor in processing_task.iter_processors():
            if processor.preprocess_related_data(processing_task):
                changed = True

        # Process all stacktraces
        for stacktrace_info, processable_frames in processing_task.iter_processable_stacktraces():
            new_frames, new_raw_frames, errors = process_single_stacktrace(
                processing_task, stacktrace_info, processable_frames)
            if new_frames is not None:
                stacktrace_info.stacktrace['frames'] = new_frames
                changed = True
            if new_raw_frames is not None and \
               stacktrace_info.container is not None:
                stacktrace_info.container['raw_stacktrace'] = dict(
                    stacktrace_info.stacktrace, frames=new_raw_frames)
                changed = True
            if errors:
                data.setdefault('errors', []).extend(errors)
                changed = True

        # Close down everything
        for processor in processors:
            processor.close()

    if changed:
        return data

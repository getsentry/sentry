from __future__ import absolute_import

import logging
import hashlib
from datetime import datetime

from collections import namedtuple

from sentry.models import Project, Release
from sentry.utils.safe import safe_execute
from sentry.utils.cache import cache

import six
from six import integer_types, text_type

logger = logging.getLogger(__name__)

StacktraceInfo = namedtuple('StacktraceInfo', ['stacktrace', 'container', 'platforms'])
StacktraceInfo.__hash__ = lambda x: id(x)
StacktraceInfo.__eq__ = lambda a, b: a is b
StacktraceInfo.__ne__ = lambda a, b: a is not b


class ProcessableFrame(object):
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
        return '<ProcessableFrame %r #%r>' % (self.frame.get('function') or 'unknown', self.idx, )

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

        h = hashlib.md5()
        h.update((u'%s\xff' % self.processor.__class__.__name__).encode('utf-8'))

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

        for value in values:
            _hash_value(value)

        self.cache_key = rv = 'pf:%s' % h.hexdigest()
        return rv


class StacktraceProcessingTask(object):
    def __init__(self, processable_stacktraces, processors):
        self.processable_stacktraces = processable_stacktraces
        self.processors = processors

    def close(self):
        for frame in self.iter_processable_frames():
            frame.close()

    def iter_processors(self):
        return iter(self.processors)

    def iter_processable_stacktraces(self):
        return six.iteritems(self.processable_stacktraces)

    def iter_processable_frames(self, processor=None):
        for _, frames in self.iter_processable_stacktraces():
            for frame in frames:
                if processor is None or frame.processor == processor:
                    yield frame


class StacktraceProcessor(object):
    def __init__(self, data, stacktrace_infos, project=None):
        self.data = data
        self.stacktrace_infos = stacktrace_infos
        if project is None:
            project = Project.objects.get_from_cache(id=data['project'])
        self.project = project

    def close(self):
        pass

    def get_release(self, create=False):
        """Convenient helper to return the release for the current data
        and optionally creates the release if it's missing.  In case there
        is no release info it will return `None`.
        """
        release = self.data.get('release')
        if not release:
            return None
        if not create:
            return Release.get(project=self.project, version=self.data['release'])
        timestamp = self.data.get('timestamp')
        if timestamp is not None:
            date = datetime.fromtimestamp(timestamp)
        else:
            date = None
        return Release.get_or_create(
            project=self.project,
            version=self.data['release'],
            date_added=date,
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
        pass

    def process_frame(self, processable_frame, processing_task):
        """Processes the processable frame and returns a tuple of three
        lists: ``(frames, raw_frames, errors)`` where frames is the list of
        processed frames, raw_frames is the list of raw unprocessed frames
        (which however can also be modified if needed) as well as a list of
        optional errors.  Each one of the items can be `None` in which case
        the original input frame is assumed.
        """

    def preprocess_step(self, processing_task):
        """After frames are preprocesed but before frame processing kicks in
        the preprocessing step is run.  This already has access to the cache
        values on the frames.
        """
        return False


def find_stacktraces_in_data(data, include_raw=False):
    """Finds all stracktraces in a given data blob and returns it
    together with some meta information.

    If `include_raw` is True, then also raw stacktraces are included.
    """
    rv = []

    def _report_stack(stacktrace, container):
        platforms = set()
        for frame in stacktrace.get('frames') or ():
            platforms.add(frame.get('platform') or data.get('platform'))
        rv.append(StacktraceInfo(stacktrace=stacktrace, container=container, platforms=platforms))

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

    if include_raw:
        for stacktrace_info in rv[:]:
            if stacktrace_info.container is None:
                continue
            raw = stacktrace_info.container.get('raw_stacktrace')
            if raw:
                _report_stack(raw, stacktrace_info.container)

    return rv


def normalize_in_app(data):
    def _get_has_system_frames(frames):
        system_frames = 0
        for frame in frames:
            if not frame.get('in_app'):
                system_frames += 1
        return bool(system_frames) and len(frames) != system_frames

    for stacktrace_info in find_stacktraces_in_data(data, include_raw=True):
        frames = stacktrace_info.stacktrace.get('frames') or ()
        has_system_frames = _get_has_system_frames(frames)
        for frame in frames:
            if not has_system_frames:
                frame['in_app'] = False
            elif frame.get('in_app') is None:
                frame['in_app'] = False


def should_process_for_stacktraces(data):
    from sentry.plugins import plugins
    infos = find_stacktraces_in_data(data)
    platforms = set()
    for info in infos:
        platforms.update(info.platforms or ())
    for plugin in plugins.all(version=2):
        processors = safe_execute(
            plugin.get_stacktrace_processors,
            data=data,
            stacktrace_infos=infos,
            platforms=platforms,
            _with_transaction=False
        )
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
        processors.extend(
            safe_execute(
                plugin.get_stacktrace_processors,
                data=data,
                stacktrace_infos=infos,
                platforms=platforms,
                _with_transaction=False
            ) or ()
        )

    if processors:
        project = Project.objects.get_from_cache(id=data['project'])
        processors = [x(data, infos, project) for x in processors]

    return processors


def get_processable_frames(stacktrace_info, processors):
    """Returns thin wrappers around the frames in a stacktrace associated
    with the processor for it.
    """
    frame_count = len(stacktrace_info.stacktrace['frames'])
    rv = []
    for idx, frame in enumerate(stacktrace_info.stacktrace['frames']):
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

    for processable_frame in processable_frames:
        try:
            rv = processable_frame.processor.process_frame(processable_frame, processing_task)
        except Exception:
            logger.exception('Failed to process frame')
            rv = None
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
        processed_frames if changed_processed else None, raw_frames
        if changed_raw else None, all_errors,
    )


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
            processable_frame.processor.preprocess_frame(processable_frame)
            by_processor.setdefault(processable_frame.processor, []) \
                .append(processable_frame)
            by_stacktrace_info.setdefault(processable_frame.stacktrace_info, []) \
                .append(processable_frame)
            if processable_frame.cache_key is not None:
                to_lookup[processable_frame.cache_key] = processable_frame

    frame_cache = lookup_frame_cache(to_lookup)
    for cache_key, processable_frame in six.iteritems(to_lookup):
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

    # Build a new processing task
    processing_task = get_stacktrace_processing_task(infos, processors)
    try:

        # Preprocess step
        for processor in processing_task.iter_processors():
            if processor.preprocess_step(processing_task):
                changed = True

        # Process all stacktraces
        for stacktrace_info, processable_frames in processing_task.iter_processable_stacktraces():
            new_frames, new_raw_frames, errors = process_single_stacktrace(
                processing_task, stacktrace_info, processable_frames
            )
            if new_frames is not None:
                stacktrace_info.stacktrace['frames'] = new_frames
                changed = True
            if new_raw_frames is not None and \
               stacktrace_info.container is not None:
                stacktrace_info.container['raw_stacktrace'] = dict(
                    stacktrace_info.stacktrace, frames=new_raw_frames
                )
                changed = True
            if errors:
                data.setdefault('errors', []).extend(dedup_errors(errors))
                changed = True

    finally:
        for processor in processors:
            processor.close()
        processing_task.close()

    if changed:
        return data

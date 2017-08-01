from __future__ import absolute_import

from libsourcemap import ProguardView
from sentry.plugins import Plugin2
from sentry.stacktraces import StacktraceProcessor
from sentry.models import ProjectDSymFile, EventError
from sentry.reprocessing import report_processing_issue

FRAME_CACHE_VERSION = 2


class JavaStacktraceProcessor(StacktraceProcessor):
    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)
        debug_meta = self.data.get('debug_meta')
        self.images = set()
        if debug_meta:
            self.available = True
            self.debug_meta = debug_meta
            for img in debug_meta['images']:
                if img['type'] == 'proguard':
                    self.images.add(img['uuid'])
        else:
            self.available = False

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get('platform') or self.data.get('platform')
        return (platform == 'java' and self.available and 'function' in frame and 'module' in frame)

    def preprocess_frame(self, processable_frame):
        processable_frame.set_cache_key_from_values(
            (
                FRAME_CACHE_VERSION, processable_frame.frame['module'],
                processable_frame.frame['function'],
            ) + tuple(sorted(self.images))
        )

    def preprocess_step(self, processing_task):
        if not self.available:
            return False

        dsym_paths = ProjectDSymFile.dsymcache.fetch_dsyms(self.project, self.images)
        self.mapping_views = []

        for image_uuid in self.images:
            error_type = None

            dsym_path = dsym_paths.get(image_uuid)
            if dsym_path is None:
                error_type = EventError.PROGUARD_MISSING_MAPPING
            else:
                view = ProguardView.from_path(dsym_path)
                if not view.has_line_info:
                    error_type = EventError.PROGUARD_MISSING_LINENO
                else:
                    self.mapping_views.append(view)

            if error_type is None:
                continue

            self.data.setdefault('errors',
                                 []).append({
                                     'type': error_type,
                                     'mapping_uuid': image_uuid,
                                 })
            report_processing_issue(
                self.data,
                scope='proguard',
                object='mapping:%s' % image_uuid,
                type=error_type,
                data={
                    'mapping_uuid': image_uuid,
                }
            )

    def process_frame(self, processable_frame, processing_task):
        new_module = None
        new_function = None
        frame = processable_frame.frame

        if processable_frame.cache_value is None:
            alias = '%s:%s' % (frame['module'], frame['function'])
            for view in self.mapping_views:
                original = view.lookup(alias, frame.get('lineno'))
                if original != alias:
                    new_module, new_function = original.split(':', 1)
                    break

            if new_module and new_function:
                processable_frame.set_cache_value([new_module, new_function])

        else:
            new_module, new_function = processable_frame.cache_value

        if not new_module or not new_function:
            return

        raw_frame = dict(frame)
        new_frame = dict(frame)
        new_frame['module'] = new_module
        new_frame['function'] = new_function

        return [new_frame], [raw_frame], []


class JavaPlugin(Plugin2):
    can_disable = False

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        if 'java' in platforms:
            return [JavaStacktraceProcessor]

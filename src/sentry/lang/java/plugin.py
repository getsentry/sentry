from __future__ import absolute_import

import six

from symbolic import ProguardMappingView
from sentry.plugins import Plugin2
from sentry.stacktraces import StacktraceProcessor
from sentry.models import ProjectDebugFile, EventError
from sentry.reprocessing import report_processing_issue
from sentry.utils.safe import get_path

FRAME_CACHE_VERSION = 2


class JavaStacktraceProcessor(StacktraceProcessor):
    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)

        self.images = set()
        self.available = False

        for image in get_path(self.data, 'debug_meta', 'images', filter=True, default=()):
            if image.get('type') == 'proguard':
                self.available = True
                self.images.add(six.text_type(image['uuid']).lower())

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get('platform') or self.data.get('platform')
        return (platform == 'java' and self.available and 'function' in frame and 'module' in frame)

    def preprocess_frame(self, processable_frame):
        processable_frame.set_cache_key_from_values(
            (
                FRAME_CACHE_VERSION, processable_frame.frame['module'],
                processable_frame.frame['function'],
            ) + tuple(sorted(map(six.text_type, self.images)))
        )

    def preprocess_step(self, processing_task):
        if not self.available:
            return False

        dif_paths = ProjectDebugFile.difcache.fetch_difs(
            self.project, self.images, features=['mapping'])
        self.mapping_views = []

        for debug_id in self.images:
            error_type = None

            dif_path = dif_paths.get(debug_id)
            if dif_path is None:
                error_type = EventError.PROGUARD_MISSING_MAPPING
            else:
                view = ProguardMappingView.from_path(dif_path)
                if not view.has_line_info:
                    error_type = EventError.PROGUARD_MISSING_LINENO
                else:
                    self.mapping_views.append(view)

            if error_type is None:
                continue

            self.data.setdefault('errors', []).append({
                'type': error_type,
                'mapping_uuid': debug_id,
            })

            report_processing_issue(
                self.data,
                scope='proguard',
                object='mapping:%s' % debug_id,
                type=error_type,
                data={
                    'mapping_uuid': debug_id,
                }
            )

        return True

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

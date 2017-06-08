from __future__ import absolute_import

from sentry.plugins import Plugin2
from sentry.stacktraces import StacktraceProcessor


FRAME_CACHE_VERSION = 1


class JavaStacktraceProcessor(StacktraceProcessor):

    def __init__(self, *args, **kwargs):
        StacktraceProcessor.__init__(self, *args, **kwargs)
        debug_meta = self.data.get('debug_meta')
        if debug_meta:
            self.available = True
            self.debug_meta = debug_meta
        else:
            self.available = False

    def handles_frame(self, frame, stacktrace_info):
        platform = frame.get('platform') or self.data.get('platform')
        return (
            platform == 'java' and
            self.available and
            'function' in frame
        )

    def preprocess_frame(self, processable_frame):
        pass

    def preprocess_step(self, processing_task):
        if not self.available:
            return False

    def process_frame(self, processable_frame, processing_task):
        pass


class JavaPlugin(Plugin2):
    can_disable = False

    def get_stacktrace_processors(self, data, stacktrace_infos,
                                  platforms, **kwargs):
        if 'java' in platforms:
            return [JavaStacktraceProcessor]

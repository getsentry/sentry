from __future__ import absolute_import

from debug_toolbar.panels import Panel
from django.utils.translation import ungettext

from ..utils.thread_collector import ThreadCollector


class CallRecordingPanel(Panel):
    def __init__(self, *args, **kwargs):
        super(CallRecordingPanel, self).__init__(*args, **kwargs)
        cls = type(self)
        if getattr(cls, '_collector', None) is None:
            self.collector = ThreadCollector()

            for context in cls.get_context(self.collector):
                context.patch()

    @classmethod
    def get_context(cls):
        """
        >>> @classmethod
        >>> def get_context(cls, collector):
        >>>     return [
        >>>         PatchContext('foo.bar', FunctionWrapper(collector))
        >>>     ]
        """
        raise NotImplementedError

    def enable_instrumentation(self):
        self.calls = self.collector.enable()

    def disable_instrumentation(self):
        self.collector.disable()

    @property
    def nav_subtitle(self):
        calls = len(self.calls)
        duration = int(sum(((c['end'] - c['start']) for c in self.calls)) * 1000)

        return ungettext('%(calls)d call in %(duration).2fms',
                         '%(calls)d calls in %(duration).2fms',
                         calls) % {'calls': calls, 'duration': duration}

from __future__ import absolute_import

from debug_toolbar.panels import Panel
from django.utils.translation import ungettext


class CallRecordingPanel(Panel):
    def __init__(self, *args, **kwargs):
        super(CallRecordingPanel, self).__init__(*args, **kwargs)
        self.calls = []
        self._context = []

        for context in self.get_context():
            self.add_context(context)

    def get_context(self):
        """
        >>> def get_context(self):
        >>>     return [
        >>>         PatchContext('foo.bar', FunctionWrapper(self.calls))
        >>>     ]
        """
        raise NotImplementedError

    def add_context(self, context):
        self._context.append(context)

    def enable_instrumentation(self):
        for context in self._context:
            context.patch()

    def disable_instrumentation(self):
        for context in self._context:
            context.unpatch()

    @property
    def nav_subtitle(self):
        calls = len(self.calls)
        duration = int(sum(((c['end'] - c['start']) for c in self.calls)) * 1000)

        return ungettext('%(calls)d call in %(duration).2fms',
                         '%(calls)d calls in %(duration).2fms',
                         calls) % {'calls': calls, 'duration': duration}

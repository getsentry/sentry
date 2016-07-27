from __future__ import absolute_import

from sentry.interfaces.base import Interface
from sentry.interfaces.stacktrace import Stacktrace
from sentry.utils.safe import trim

__all__ = ('Threads',)


class Threads(Interface):
    score = 1900

    @classmethod
    def to_python(cls, data):
        threads = []

        for thread in data.get('values') or ():
            stacktrace = thread.get('stacktrace')
            if stacktrace is not None:
                # Special case: if the thread has no frames we set the
                # stacktrace to none.  Otherwise this will fail really
                # badly.
                if not stacktrace.get('frames'):
                    stacktrace = None
                else:
                    stacktrace = Stacktrace.to_python(stacktrace,
                                                      slim_frames=True)
            threads.append({
                'stacktrace': stacktrace,
                'id': trim(thread.get('id'), 40),
                'crashed': bool(thread.get('crashed')),
                'current': bool(thread.get('current')),
                'name': trim(thread.get('name'), 200),
            })

        return cls(values=threads)

    def to_json(self):
        def export_thread(data):
            rv = {
                'id': data['id'],
                'current': data['current'],
                'crashed': data['crashed'],
                'name': data['name'],
                'stacktrace': None,
            }
            if data['stacktrace']:
                rv['stacktrace'] = data['stacktrace'].to_json()
            return rv

        return {
            'values': [export_thread(x) for x in self.values],
        }

    def get_api_context(self, is_public=False):
        def export_thread(data):
            rv = {
                'id': data['id'],
                'current': data['current'],
                'crashed': data['crashed'],
                'name': data['name'],
                'stacktrace': None,
            }
            if data['stacktrace']:
                rv['stacktrace'] = data['stacktrace'].get_api_context(
                    is_public=is_public)
            return rv

        return {
            'values': [export_thread(x) for x in self.values],
        }

    def get_path(self):
        return 'threads'

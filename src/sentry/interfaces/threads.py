from __future__ import absolute_import

from sentry.interfaces.base import Interface
from sentry.interfaces.stacktrace import Stacktrace
from sentry.utils.safe import trim

__all__ = ('Threads',)


def get_stacktrace(value):
    # Special case: if the thread has no frames we set the
    # stacktrace to none.  Otherwise this will fail really
    # badly.
    if value and value.get('frames'):
        return Stacktrace.to_python(value, slim_frames=True)


class Threads(Interface):
    score = 1900

    @classmethod
    def to_python(cls, data):
        threads = []

        for thread in data.get('values') or ():
            threads.append({
                'stacktrace': get_stacktrace(thread.get('stacktrace')),
                'raw_stacktrace': get_stacktrace(thread.get('raw_stacktrace')),
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
            if data['raw_stacktrace']:
                rv['raw_stacktrace'] = data['raw_stacktrace'].to_json()
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
                'rawStacktrace': None,
            }
            if data['stacktrace']:
                rv['stacktrace'] = data['stacktrace'].get_api_context(
                    is_public=is_public)
            if data['raw_stacktrace']:
                rv['rawStacktrace'] = data['raw_stacktrace'].get_api_context(
                    is_public=is_public)
            return rv

        return {
            'values': [export_thread(x) for x in self.values],
        }

    def get_path(self):
        return 'threads'

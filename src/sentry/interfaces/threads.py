from __future__ import absolute_import

from sentry.interfaces.base import Interface
from sentry.interfaces.stacktrace import Stacktrace
from sentry.utils.safe import trim

__all__ = ('Threads',)


class Threads(Interface):
    score = 3000

    @classmethod
    def to_python(cls, data):
        threads = []

        for thread in data.get('threads') or ():
            stacktrace = None
            if 'stacktrace' in thread:
                stacktrace = Stacktrace.to_python(
                    thread['stacktrace'],
                    slim_frames=True,
                )

            threads.append({
                'stacktrace': stacktrace,
                'index': trim(thread.get('trim'), 20),
                'id': trim(thread.get('id'), 40),
                'current': bool(thread.get('current')),
                'name': trim(thread.get('name'), 200),
            })

        return cls(threads=threads)

    def to_json(self):
        def export_thread(data):
            rv = {
                'index': data['index'],
                'id': data['id'],
                'current': data['current'],
                'name': data['name'],
                'stacktrace': None,
            }
            if data['stacktrace']:
                rv['stacktrace'] = data['stacktrace'].to_json()
            return data

        return {
            'threads': [export_thread(x) for x in self.threads],
        }

    def get_path(self):
        return 'threads'

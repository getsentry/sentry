from __future__ import absolute_import

from .base import BaseEvent


class CspEvent(BaseEvent):
    key = 'csp'

    def has_metadata(self):
        return 'sentry.interfaces.Csp' in self.data

    def get_metadata(self):
        # TODO(dcramer): we need to avoid importing interfaces in this module
        # due to recursion at top level
        from sentry.interfaces.csp import Csp
        # TODO(dcramer): pull get message into here to avoid instantiation
        # or ensure that these get interfaces passed instead of raw data
        csp = Csp.to_python(self.data['sentry.interfaces.Csp'])

        return {
            'directive': csp.effective_directive,
            'uri': csp._normalized_blocked_uri,
            'message': csp.get_message(),
        }

    def to_string(self, metadata):
        return metadata['message']

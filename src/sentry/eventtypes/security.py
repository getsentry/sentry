from __future__ import absolute_import

from .base import BaseEvent


class CspEvent(BaseEvent):
    key = 'csp'

    def has_metadata(self):
        return self.data.get('csp') is not None

    def get_metadata(self):
        from sentry.interfaces.security import Csp
        # TODO(dcramer): pull get message into here to avoid instantiation
        # or ensure that these get interfaces passed instead of raw data
        csp = Csp.to_python(self.data['csp'])

        return {
            'directive': csp.effective_directive,
            'uri': csp._normalized_blocked_uri,
            'message': csp.get_message(),
        }

    def to_string(self, metadata):
        return metadata['message']


class HpkpEvent(BaseEvent):
    key = 'hpkp'

    def has_metadata(self):
        return self.data.get('hpkp') is not None

    def get_metadata(self):
        from sentry.interfaces.security import Hpkp
        hpkp = Hpkp.to_python(self.data['hpkp'])
        return {
            'origin': hpkp.get_origin(),
            'message': hpkp.get_message(),
        }

    def to_string(self, metadata):
        return metadata['message']


class ExpectCTEvent(BaseEvent):
    key = 'expectct'

    def has_metadata(self):
        return self.data.get('expectct') is not None

    def get_metadata(self):
        from sentry.interfaces.security import ExpectCT
        expectct = ExpectCT.to_python(self.data['expectct'])
        return {
            'origin': expectct.get_origin(),
            'message': expectct.get_message(),
        }

    def to_string(self, metadata):
        return metadata['message']


class ExpectStapleEvent(BaseEvent):
    key = 'expectstaple'

    def has_metadata(self):
        return self.data.get('expectstaple') is not None

    def get_metadata(self):
        from sentry.interfaces.security import ExpectStaple
        expectstaple = ExpectStaple.to_python(self.data['expectstaple'])
        return {
            'origin': expectstaple.get_origin(),
            'message': expectstaple.get_message(),
        }

    def to_string(self, metadata):
        return metadata['message']

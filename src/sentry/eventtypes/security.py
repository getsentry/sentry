from __future__ import absolute_import

from .base import BaseEvent


class CspEvent(BaseEvent):
    key = "csp"

    def get_metadata(self, data):
        from sentry.interfaces.security import Csp

        # TODO(dcramer): pull get message into here to avoid instantiation
        # or ensure that these get interfaces passed instead of raw data
        csp = Csp.to_python(data["csp"])

        return {
            "directive": csp.effective_directive,
            "uri": csp.normalized_blocked_uri,
            "message": csp.get_message(),
        }

    def get_title(self, metadata):
        return metadata["message"]

    def get_location(self, metadata):
        return metadata.get("uri")


class HpkpEvent(BaseEvent):
    key = "hpkp"

    def get_metadata(self, data):
        from sentry.interfaces.security import Hpkp

        hpkp = Hpkp.to_python(data["hpkp"])
        return {"origin": hpkp.get_origin(), "message": hpkp.get_message()}

    def get_title(self, metadata):
        return metadata["message"]

    def get_location(self, metadata):
        return metadata.get("origin")


class ExpectCTEvent(BaseEvent):
    key = "expectct"

    def get_metadata(self, data):
        from sentry.interfaces.security import ExpectCT

        expectct = ExpectCT.to_python(data["expectct"])
        return {"origin": expectct.get_origin(), "message": expectct.get_message()}

    def get_title(self, metadata):
        return metadata["message"]

    def get_location(self, metadata):
        return metadata.get("origin")


class ExpectStapleEvent(BaseEvent):
    key = "expectstaple"

    def get_metadata(self, data):
        from sentry.interfaces.security import ExpectStaple

        expectstaple = ExpectStaple.to_python(data["expectstaple"])
        return {"origin": expectstaple.get_origin(), "message": expectstaple.get_message()}

    def get_title(self, metadata):
        return metadata["message"]

    def get_location(self, metadata):
        return metadata.get("origin")

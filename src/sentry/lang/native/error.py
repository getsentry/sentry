from __future__ import annotations

import logging

from sentry.lang.native.utils import image_name
from sentry.models.eventerror import EventError

FATAL_ERRORS = (
    EventError.NATIVE_MISSING_DSYM,
    EventError.NATIVE_BAD_DSYM,
    EventError.NATIVE_SYMBOLICATOR_FAILED,
)

USER_FIXABLE_ERRORS = (
    EventError.NATIVE_MISSING_DSYM,
    EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM,
    EventError.NATIVE_BAD_DSYM,
    # We tried to use a debug file for a purpose it doesn't support.
    # Currently this only happens when trying to symbolicate a
    # CLR (.NET) event with a Windows PDB file. The tracking issue
    # for supporting this is
    # https://github.com/getsentry/team-ingest/issues/550.
    EventError.NATIVE_UNSUPPORTED_DSYM,
    EventError.NATIVE_MISSING_SYMBOL,
    EventError.FETCH_GENERIC_ERROR,
    # Emitted for e.g. broken minidumps
    EventError.NATIVE_SYMBOLICATOR_FAILED,
    # We want to let the user know when calling symbolicator failed, even
    # though it's not user fixable.
    EventError.NATIVE_INTERNAL_FAILURE,
)

logger = logging.getLogger(__name__)


class SymbolicationFailed(Exception):
    message = None

    def __init__(self, message=None, type=None, obj=None):
        Exception.__init__(self)
        self.message = str(message)
        self.type = type
        self.image_name: str | None = None
        self.image_path: str | None = None
        if obj is not None:
            self.image_uuid: str | None = str(obj.debug_id)
            if obj.name:
                self.image_path = obj.name
                self.image_name = image_name(obj.name)
            self.image_arch: str | None = obj.arch
        else:
            self.image_uuid = None
            self.image_arch = None

    @property
    def is_user_fixable(self):
        """These are errors that a user can fix themselves."""
        return self.type in USER_FIXABLE_ERRORS

    @property
    def is_fatal(self):
        """If this is true then a processing issues has to be reported."""
        return self.type in FATAL_ERRORS

    @property
    def is_sdk_failure(self):
        """An error that most likely happened because of a bad SDK."""
        return self.type == EventError.NATIVE_UNKNOWN_IMAGE

    def get_data(self):
        """Returns the event data."""
        rv = {"message": self.message, "type": self.type}
        if self.image_path is not None:
            rv["image_path"] = self.image_path
        if self.image_uuid is not None:
            rv["image_uuid"] = self.image_uuid
        if self.image_arch is not None:
            rv["image_arch"] = self.image_arch
        return rv

    def __str__(self):
        rv = []
        if self.type is not None:
            rv.append("%s: " % self.type)
        rv.append(self.message or "no information available")
        if self.image_uuid is not None:
            rv.append(" image-uuid=%s" % self.image_uuid)
        if self.image_name is not None:
            rv.append(" image-name=%s" % self.image_name)
        return "".join(rv)


def write_error(e, data):
    if e.is_user_fixable or e.is_sdk_failure:
        errors = data.setdefault("errors", [])
        errors.append(e.get_data())
    else:
        logger.debug("Failed to symbolicate with native backend")

    if not e.is_user_fixable:
        data.setdefault("_metrics", {})["flag.processing.error"] = True

    if e.is_fatal:
        data.setdefault("_metrics", {})["flag.processing.fatal"] = True

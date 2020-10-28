from __future__ import absolute_import

import logging
import six

from sentry.utils.compat import implements_to_string
from sentry.lang.native.utils import image_name, is_minidump_event
from sentry.models import EventError
from sentry.reprocessing import report_processing_issue

FATAL_ERRORS = (
    EventError.NATIVE_MISSING_DSYM,
    EventError.NATIVE_BAD_DSYM,
    EventError.NATIVE_SYMBOLICATOR_FAILED,
)

USER_FIXABLE_ERRORS = (
    EventError.NATIVE_MISSING_DSYM,
    EventError.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM,
    EventError.NATIVE_BAD_DSYM,
    EventError.NATIVE_MISSING_SYMBOL,
    # Emitted for e.g. broken minidumps
    EventError.NATIVE_SYMBOLICATOR_FAILED,
    # We want to let the user know when calling symbolicator failed, even
    # though it's not user fixable.
    EventError.NATIVE_INTERNAL_FAILURE,
)

logger = logging.getLogger(__name__)


@implements_to_string
class SymbolicationFailed(Exception):
    message = None

    def __init__(self, message=None, type=None, obj=None):
        Exception.__init__(self)
        self.message = six.text_type(message)
        self.type = type
        self.image_name = None
        self.image_path = None
        if obj is not None:
            self.image_uuid = six.text_type(obj.debug_id)
            if obj.name:
                self.image_path = obj.name
                self.image_name = image_name(obj.name)
            self.image_arch = obj.arch
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
            rv.append(u"%s: " % self.type)
        rv.append(self.message or "no information available")
        if self.image_uuid is not None:
            rv.append(" image-uuid=%s" % self.image_uuid)
        if self.image_name is not None:
            rv.append(" image-name=%s" % self.image_name)
        return u"".join(rv)


def write_error(e, data):
    # User fixable but fatal errors are reported as processing
    # issues. We skip this for minidumps, as reprocessing is not
    # possible without persisting minidumps.
    if e.is_user_fixable and e.is_fatal and not is_minidump_event(data):
        report_processing_issue(
            data, scope="native", object="dsym:%s" % e.image_uuid, type=e.type, data=e.get_data()
        )

    # This in many ways currently does not really do anything.
    # The reason is that once a processing issue is reported
    # the event will only be stored as a raw event and no
    # group will be generated.  As a result it also means that
    # we will not have any user facing event or error showing
    # up at all.  We want to keep this here though in case we
    # do not want to report some processing issues (eg:
    # optional difs)
    if e.is_user_fixable or e.is_sdk_failure:
        errors = data.setdefault("errors", [])
        errors.append(e.get_data())
    else:
        logger.debug("Failed to symbolicate with native backend", exc_info=True)

    if not e.is_user_fixable:
        data.setdefault("_metrics", {})["flag.processing.error"] = True

    if e.is_fatal:
        data.setdefault("_metrics", {})["flag.processing.fatal"] = True

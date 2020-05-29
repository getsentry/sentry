from __future__ import absolute_import

from sentry.utils.safe import get_path


# Attachment type used for Apple Crash Reports
APPLECRASHREPORT_ATTACHMENT_TYPE = "event.applecrashreport"


def is_applecrashreport_event(data):
    """
    Checks whether an event indicates that it has an apple crash report.

    This requires the event to have a special marker payload. It is written by
    ``write_applecrashreport_placeholder``.
    """
    exceptions = get_path(data, "exception", "values", filter=True)
    return get_path(exceptions, 0, "mechanism", "type") == "applecrashreport"

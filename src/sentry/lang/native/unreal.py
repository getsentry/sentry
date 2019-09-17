from __future__ import absolute_import

from sentry.models import UserReport
from sentry.lang.native.minidump import MINIDUMP_ATTACHMENT_TYPE
from sentry.utils.safe import get_path, set_path, setdefault_path


# Attachment type used for Apple Crash Reports
APPLECRASHREPORT_ATTACHMENT_TYPE = "event.applecrashreport"


def write_applecrashreport_placeholder(data):
    """
    Writes a placeholder to indicate that this event has an apple crash report.

    This will indicate to the ingestion pipeline that this event will need to be
    processed. The payload can be checked via ``is_applecrashreport_event``.
    """
    # Apple crash report events must be native platform for processing.
    data["platform"] = "native"

    # Assume that this minidump is the result of a crash and assign the fatal
    # level. Note that the use of `setdefault` here doesn't generally allow the
    # user to override the minidump's level as processing will overwrite it
    # later.
    setdefault_path(data, "level", value="fatal")

    # Create a placeholder exception. This signals normalization that this is an
    # error event and also serves as a placeholder if processing of the minidump
    # fails.
    exception = {
        "type": "AppleCrashReport",
        "value": "Invalid Apple Crash Report",
        "mechanism": {"type": "applecrashreport", "handled": False, "synthetic": True},
    }
    data["exception"] = {"values": [exception]}


def is_applecrashreport_event(data):
    """
    Checks whether an event indicates that it has an apple crash report.

    This requires the event to have a special marker payload. It is written by
    ``write_applecrashreport_placeholder``.
    """
    exceptions = get_path(data, "exception", "values", filter=True)
    return get_path(exceptions, 0, "mechanism", "type") == "applecrashreport"


def merge_unreal_user(event, user_id):
    """
    Merges user information from the unreal "UserId" into the event payload.
    """

    # https://github.com/EpicGames/UnrealEngine/blob/f509bb2d6c62806882d9a10476f3654cf1ee0634/Engine/Source/Programs/CrashReportClient/Private/CrashUpload.cpp#L769
    parts = user_id.split("|", 2)
    login_id, epic_account_id, machine_id = parts + [""] * (3 - len(parts))
    event["user"] = {"id": login_id if login_id else user_id}
    if epic_account_id:
        set_path(event, "tags", "epic_account_id", value=epic_account_id)
    if machine_id:
        set_path(event, "tags", "machine_id", value=machine_id)


def unreal_attachment_type(unreal_file):
    """Returns the `attachment_type` for the
    unreal file type or None if not recognized"""
    if unreal_file.type == "minidump":
        return MINIDUMP_ATTACHMENT_TYPE
    if unreal_file.type == "applecrashreport":
        return APPLECRASHREPORT_ATTACHMENT_TYPE


def merge_unreal_context_event(unreal_context, event, project):
    """Merges the context from an Unreal Engine 4 crash
    with the given event."""
    runtime_prop = unreal_context.get("runtime_properties")
    if runtime_prop is None:
        return

    message = runtime_prop.pop("error_message", None)
    if message is not None:
        event["message"] = message

    username = runtime_prop.pop("username", None)
    if username is not None:
        set_path(event, "user", "username", value=username)

    memory_physical = runtime_prop.pop("memory_stats_total_physical", None)
    if memory_physical is not None:
        set_path(event, "contexts", "device", "memory_size", value=memory_physical)

    # Likely overwritten by minidump processing
    os_major = runtime_prop.pop("misc_os_version_major", None)
    if os_major is not None:  # i.e: Windows 10
        set_path(event, "contexts", "os", "name", value=os_major)

    gpu_brand = runtime_prop.pop("misc_primary_cpu_brand", None)
    if gpu_brand is not None:
        set_path(event, "contexts", "gpu", "name", value=gpu_brand)

    user_desc = runtime_prop.pop("user_description", None)
    if user_desc is not None:
        feedback_user = "unknown"
        if username is not None:
            feedback_user = username

        UserReport.objects.create(
            project=project,
            event_id=event["event_id"],
            name=feedback_user,
            email="",
            comments=user_desc,
        )

    # drop modules. minidump processing adds 'images loaded'
    runtime_prop.pop("modules", None)

    # add everything else as extra
    set_path(event, "contexts", "unreal", "type", value="unreal")
    event["contexts"]["unreal"].update(**runtime_prop)

    # add sdk info
    event["sdk"] = {
        "name": "sentry.unreal.crashreporter",
        "version": runtime_prop.pop("crash_reporter_client_version", "0.0.0"),
    }


def merge_unreal_logs_event(unreal_logs, event):
    setdefault_path(event, "breadcrumbs", "values", value=[])
    breadcrumbs = event["breadcrumbs"]["values"]

    for log in unreal_logs:
        message = log.get("message")
        if message:
            breadcrumbs.append(
                {
                    "timestamp": log.get("timestamp"),
                    "category": log.get("component"),
                    "message": message,
                }
            )

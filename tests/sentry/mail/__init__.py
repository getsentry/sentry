from typing import Any, Mapping

from sentry.event_manager import EventManager, get_event_type
from sentry.mail import send_notification_as_email


def make_event_data(filename: str, url: str = "http://example.com") -> Mapping[str, Any]:
    mgr = EventManager(
        {
            "tags": [("level", "error")],
            "stacktrace": {"frames": [{"lineno": 1, "filename": filename}]},
            "request": {"url": url},
        }
    )
    mgr.normalize()
    data = mgr.get_data()
    event_type = get_event_type(data)
    data["type"] = event_type.key
    data["metadata"] = event_type.get_metadata(data)
    return data


def send_notification(*args: Any) -> None:
    args_list = list(args)[1:]
    send_notification_as_email(*args_list, {})

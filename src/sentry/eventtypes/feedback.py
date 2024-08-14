from sentry.eventtypes.base import BaseEvent
from sentry.utils.safe import get_path


class FeedbackEvent(BaseEvent):
    key = "feedback"

    def extract_metadata(self, data):
        contact_email = get_path(data, "contexts", "feedback", "contact_email")
        message = get_path(data, "contexts", "feedback", "message")
        name = get_path(data, "contexts", "feedback", "name")
        source = get_path(data, "contexts", "feedback", "source")
        return {"contact_email": contact_email, "message": message, "name": name, "source": source}

from sentry.eventtypes.base import BaseEvent
from sentry.utils.safe import get_path


class FeedbackEvent(BaseEvent):
    key = "feedback"

    def extract_metadata(self, data):
        contact_email = get_path(data, "contexts", "feedback", "contact_email")
        message = get_path(data, "contexts", "feedback", "message")
        return {"contact_email": contact_email, "message": message}

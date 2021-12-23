from sentry.utils.safe import get_path

from .base import BaseEvent


class TransactionEvent(BaseEvent):
    key = "transaction"

    def extract_metadata(self, data):
        """
        Extracts metadata from the event data that is sent to Rollbar.

        :param dict data: The event payload received from Rollbar.
        :returns dict: A dictionary
        containing the title and location of the event. If no title or location can be extracted, then an empty dictionary is returned instead.
        """
        description = get_path(data, "contexts", "trace", "description")
        transaction = get_path(data, "transaction")
        return {"title": description or transaction, "location": transaction}

    def get_location(self, metadata):
        return metadata["location"]

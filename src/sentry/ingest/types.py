from enum import StrEnum


class ConsumerType(StrEnum):
    """
    Defines the types of ingestion consumers
    """

    Events = "events"  # consumes simple events ( from the Events topic)
    Attachments = "attachments"  # consumes events with attachments ( from the Attachments topic)
    Transactions = "transactions"  # consumes transaction events ( from the Transactions topic)
    Feedback = "feedback"  # consumes user feedback ( from the ingest-feedback-events topic)

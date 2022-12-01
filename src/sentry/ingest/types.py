class ConsumerType:
    """
    Defines the types of ingestion consumers
    """

    Events = "events"  # consumes simple events ( from the Events topic)
    Attachments = "attachments"  # consumes events with attachments ( from the Attachments topic)
    Transactions = "transactions"  # consumes transaction events ( from the Transactions topic)
    Occurrences = "occurrences"  # consumes issue occurrences ( from the Occurrences topic)

    @staticmethod
    def all():
        return (
            ConsumerType.Events,
            ConsumerType.Attachments,
            ConsumerType.Transactions,
            # ConsumerType.Occurrences,
        )

    @staticmethod
    def get_topic_name(consumer_type):
        from django.conf import settings

        if consumer_type == ConsumerType.Events:
            return settings.KAFKA_INGEST_EVENTS
        elif consumer_type == ConsumerType.Attachments:
            return settings.KAFKA_INGEST_ATTACHMENTS
        elif consumer_type == ConsumerType.Transactions:
            return settings.KAFKA_INGEST_TRANSACTIONS
        elif consumer_type == ConsumerType.Occurrences:
            return settings.KAFKA_INGEST_OCCURRENCES
        raise ValueError("Invalid consumer type", consumer_type)

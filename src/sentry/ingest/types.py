class ConsumerType:
    """
    Defines the types of ingestion consumers
    """

    EVENTS = "events"  # consumes simple events ( from the Events topic)
    ATTACHMENTS = "attachments"  # consumes events with attachments ( from the Attachments topic)
    TRANSACTIONS = "transactions"  # consumes transaction events ( from the Transactions topic)
    FEEDBACK = "feedback"  # consumes user feedback ( from the ingest-feedback-events topic)

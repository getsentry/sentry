from abc import ABC, abstractmethod
from enum import Enum
import logging

class EventStageStatus(Enum):
    START = "start"
    END = "end"
    """
    i plan on adding the below enums for every step of the transactions pipeline
    ingest_consumer_published

    redis_put

    save_event_started

    save_event_finished

    snuba_topic_put

    billing_topic_put

    commit_log_topic_put

    ppf_consumer_started

    ppf_consumer_finished

    post_process_started

    post_process_finished / is it the same as redis_deleted?
    """

class EventTrackerBackend(ABC):
    """
    Abstract base class for event lineage tracking within a pipeline component.
    """
    @abstractmethod
    def record_processing_phase(self, event_id: str, status: EventStageStatus):
        """
        Records how far an event has made it through the ingestion pipeline.

        Args:
            event_id (str): Unique identifier of the event.
            status (ProcessingPhase): The status of each step of the data lineage, either START or END.
        """
        raise NotImplementedError

class EventTracker(EventTrackerBackend):
    """
    Logger-based implementation of EventTrackerBackend. The data will be saved in BigQuery using Google Log Sink
    """
    def __init__(self):
        self.logger = logging.getLogger("EventTracker")
        logging.basicConfig(level=logging.INFO)

    def record_event_stage_status(self, event_id: str, status: EventStageStatus):
        details = details or {}
        self.logger.info(f"EventTracker recorded event {event_id} - {status.value}")

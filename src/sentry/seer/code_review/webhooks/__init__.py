"""
Preprocessors can be used by the GitHub webhook handler to preprocess the event before it is processed. They're useful to schedule tasks for later processing.
Processors are in charge of processing the event.
"""

from .check_run import process_check_run_event
from .preprocessor import preprocess_webhook_event as code_review_webhook_processor

# These handle the work rather than sending it to Seer.
PROCESSORS = [
    process_check_run_event,
]

__all__ = ["code_review_webhook_processor", "PROCESSORS"]

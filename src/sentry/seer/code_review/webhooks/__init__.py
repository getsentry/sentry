"""
Preprocessors can be used by the GitHub webhook handler to preprocess the event before it is processed. They're useful to schedule tasks for later processing.
Processors are in charge of processing the event.
"""

from .check_run import preprocess_check_run_event, process_check_run_event

# Add new preprocessors here.
PREPROCESSORS = [
    preprocess_check_run_event,
]
# Add new webhook processors here.
PROCESSORS = [
    process_check_run_event,
]

__all__ = ["PREPROCESSORS", "PROCESSORS"]

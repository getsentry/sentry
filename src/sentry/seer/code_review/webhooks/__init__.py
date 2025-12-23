"""
This module provides a single entry point for the webhook handler to preprocess the webhook and schedule tasks for later processing.
It also provides a single entry point for the task processor to process each task.
"""

from .preprocessor import preprocess_webhook_event as code_review_webhook_processor
from .processor import process_task_event

__all__ = ["code_review_webhook_processor", "process_task_event"]

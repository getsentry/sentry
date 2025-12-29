"""
This module provides a single entry point for the webhook handler to handle webhook events.
"""

from .handlers import handle_webhook_event as code_review_webhook_processor

__all__ = ["code_review_webhook_processor"]

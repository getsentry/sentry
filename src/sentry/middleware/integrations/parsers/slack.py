from __future__ import annotations

import logging

from sentry.models.integrations import Integration

from .base import BaseRequestParser

logger = logging.getLogger(__name__)


class SlackRequestParser(BaseRequestParser):
    def get_integration(self) -> Integration | None:
        return None

    def get_response(self):
        return self.get_response_from_control_silo()

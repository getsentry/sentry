from __future__ import annotations

from sentry.notebooks.models import Notebook
from sentry.notebooks.telemetry import investigation_attributes, record_count


def record_investigation_started(investigation: Notebook) -> None:
    record_count("investigations.started", investigation_attributes(investigation))

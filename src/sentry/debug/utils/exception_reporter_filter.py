from __future__ import annotations

from typing import int, Any

from django.views.debug import SafeExceptionReporterFilter


class NoSettingsExceptionReporterFilter(SafeExceptionReporterFilter):
    def get_safe_settings(self) -> dict[str, Any]:
        return {}

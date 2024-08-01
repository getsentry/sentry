from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sentry.lang.java.processing import deobfuscate_exception_value
from sentry.lang.java.utils import has_proguard_file
from sentry.plugins.base.v2 import EventPreprocessor, Plugin2


class JavaPlugin(Plugin2):
    can_disable = False

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        return []

    def get_event_preprocessors(self, data: Mapping[str, Any]) -> Sequence[EventPreprocessor]:
        if has_proguard_file(data):
            return [deobfuscate_exception_value]
        else:
            return []

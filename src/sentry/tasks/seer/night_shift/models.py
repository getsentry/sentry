from __future__ import annotations

import enum
from dataclasses import dataclass

from sentry.models.group import Group


class TriageAction(enum.StrEnum):
    AUTOFIX = "autofix"
    ROOT_CAUSE_ONLY = "root_cause_only"
    SKIP = "skip"


@dataclass
class TriageResult:
    group: Group
    action: TriageAction = TriageAction.AUTOFIX

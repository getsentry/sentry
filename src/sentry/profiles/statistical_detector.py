from dataclasses import dataclass
from datetime import datetime
from typing import List

from sentry.models.project import Project


@dataclass(frozen=True)
class FunctionData:
    timestamp: datetime
    fingerprint: int
    count: int
    p95: int


def detect_function_regression(project: Project, data: List[FunctionData]):
    pass

"""
Query generator backends for physical queries.
"""

from .base import MetricsBackend
from .snuba import SnubaMetricsBackend

__all__ = (
    "MetricsBackend",
    "default_backend",
)

default_backend = SnubaMetricsBackend()

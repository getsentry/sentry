"""
Query generator backends for physical queries.
"""

from .snuba import SnubaMetricsBackend

default_backend = SnubaMetricsBackend()

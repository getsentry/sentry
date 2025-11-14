from typing import int
from enum import Enum


class QuerySource(Enum):
    FRONTEND = "frontend"
    API = "api"
    SENTRY_BACKEND = "sentry_backend"

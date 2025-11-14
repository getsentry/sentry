# Compatibility shim for moved endpoint
# This file exists to maintain backwards compatibility for external consumers
from typing import int
from sentry.core.endpoints.organization_details import *  # noqa: F403,F401

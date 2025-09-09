# Backwards compatibility shim for dependent repos
# This module provides backwards compatibility for imports that were moved to core endpoints.
# The actual implementation is now in src/sentry/core/endpoints/organization_member_utils.py

from sentry.core.endpoints.organization_member_details import ERR_ONLY_OWNER_OR_MANAGER
from sentry.core.endpoints.organization_member_utils import ROLE_CHOICES

__all__ = ["ROLE_CHOICES", "ERR_ONLY_OWNER_OR_MANAGER"]

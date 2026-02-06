from __future__ import annotations


class NoPreprodQuota(Exception):
    """Raised when an organization has no quota available for preprod features."""

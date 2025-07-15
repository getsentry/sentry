from __future__ import annotations

CACHE_KEY_PATTERN = "data_access_grant:effective_grant_status:{}"
NEGATIVE_CACHE_TTL = 15 * 60  # 15 minutes
NEGATIVE_CACHE_VALUE = {"no_active_grants": True}  # Special value for negative caching

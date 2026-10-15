"""Classify the scopes a caller holds.

Deprecated scopes are the broad read scopes we want to retire
(`settings.DEPRECATED_SCOPES`); granular scopes are the ones replacing them
(`settings.GRANULAR_SCOPES`). Reported per request on the `api.attribution`
metrics (`sentry.api.client_kind`).
"""

from __future__ import annotations

from collections.abc import Iterable

from django.conf import settings


def has_deprecated_scopes(scopes: Iterable[str]) -> bool:
    return not settings.DEPRECATED_SCOPES.isdisjoint(scopes)


def has_granular_scopes(scopes: Iterable[str]) -> bool:
    return not settings.GRANULAR_SCOPES.isdisjoint(scopes)

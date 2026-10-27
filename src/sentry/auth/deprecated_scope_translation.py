"""Translate deprecated scopes into the granular scopes replacing them.

Tokens minted before granular scopes existed only hold the broad deprecated scopes
(e.g. `org:read`). So they keep working once endpoints stop accepting those scopes,
each deprecated scope a token holds is replaced at request time with its entry in
`settings.DEPRECATED_SCOPE_TRANSLATIONS`. Stored token scopes are never rewritten.

The translation only runs while the `auth.deprecated-scope-translation.enabled` option is on.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from django.conf import settings

from sentry import options
from sentry.utils import metrics


def get_deprecated_scope_translations(scopes: Iterable[str]) -> dict[str, frozenset[str]]:
    """Map each deprecated scope in `scopes` to the granular scopes it adds."""
    scopes = frozenset(scopes)
    translations: Mapping[str, frozenset[str]] = settings.DEPRECATED_SCOPE_TRANSLATIONS
    added: dict[str, frozenset[str]] = {}
    for deprecated_scope in sorted(scopes & translations.keys()):
        if new_scopes := translations[deprecated_scope] - scopes:
            added[deprecated_scope] = new_scopes
    return added


def translate_deprecated_scopes(scopes: Iterable[str]) -> frozenset[str]:
    """Return `scopes` with each deprecated scope replaced by the scopes it translates to."""
    scopes = frozenset(scopes)
    # TODO: Enable this option everywhere and remove it before any endpoint stops accepting a
    # deprecated scope regardless of it. Disabling it after that breaks tokens only holding one.
    if not options.get("auth.deprecated-scope-translation.enabled"):
        return scopes
    translations: Mapping[str, frozenset[str]] = settings.DEPRECATED_SCOPE_TRANSLATIONS
    deprecated_scopes = scopes & translations.keys()
    return (scopes - deprecated_scopes).union(
        *(translations[deprecated_scope] for deprecated_scope in deprecated_scopes)
    )


def record_deprecated_scope_translation(scopes: Iterable[str], tags: Mapping[str, str]) -> None:
    """Count the deprecated scopes that added granular scopes for this caller."""
    if not options.get("auth.deprecated-scope-translation.enabled"):
        return
    for deprecated_scope in get_deprecated_scope_translations(scopes):
        metrics.incr(
            "auth.deprecated_scope_translation.applied",
            tags={**tags, "deprecated_scope": deprecated_scope},
        )

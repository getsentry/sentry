"""
Comparison logic for deciding whether two exception types are different enough that a Seer
similarity match between them should be rejected.

Baseline (hash-based) grouping treats ``exception.type`` as a hard grouping input: two events with
different types never share a hash. Seer ignores the type entirely and matches on stacktrace
similarity, which is frequently what we want — it rescues events whose stacktraces drifted (minified
frames, changing paths, inlined frames) but which are the same underlying bug.

So the question here is never "are these two events similar?" — Seer has already said yes. It's
narrower: **is the type difference by itself proof that Seer is wrong?** We only reject when we're
confident the answer is yes, because rejecting is not free: with
``seer.similarity.ingest.num_matches_to_request`` set to 1 there is no runner-up match to fall back
on, so every rejection opens a brand-new group.

Two families of difference clear that bar today:

1. **App hangs of differing fatality.** A fatal hang (the app was killed) and a non-fatal hang (it
   recovered) are different events for the user even when the stacktrace is identical, and mixing
   them corrupts the fatal-only alerting that `error.type` powers. See ``_app_hang_mismatch``.

2. **Distinct, stable, hand-written type names.** ``ValueError`` vs ``TypeError`` is a real
   difference in kind, not an artifact. See ``_distinct_stable_type_names``.

Everything else — types containing whitespace, types differing only in embedded variable data,
namespace-relative spellings of the same class, minified names — is deliberately left to fall
through and be accepted, and is logged by the caller so we can keep narrowing.
"""

from __future__ import annotations

import re
from enum import StrEnum

from sentry.grouping.parameterization import parameterizer

# Platforms whose exception types are stable, human-authored identifiers. Restricting the
# distinct-type-name rejection to these keeps us away from platforms where the same class can
# legitimately show up under different names: minifiers and obfuscators (JavaScript, obfuscated
# Android) rename classes per build, so `V` in one release and `bm` in the next may well be the very
# same class. Those get logged, not rejected.
PLATFORMS_WITH_STABLE_TYPE_NAMES = frozenset(
    [
        "python",
        "ruby",
        "php",
        "java",
        "go",
        "csharp",
        "elixir",
        "perl",
    ]
)

# `ErrorEvent.extract_metadata` falls back to this when an exception has no type at all, so seeing it
# tells us the type is absent — not that it differs from the other side.
GENERIC_TYPE_PLACEHOLDER = "Error"

# Cocoa app-hang types are built by the SDK from two independent dimensions:
#
#   ("Fatal " | "") + "App Hang" + (" Fully Blocked" | " Non Fully Blocked")
#
# e.g. "Fatal App Hang Fully Blocked", "App Hang Non Fully Blocked". Older SDK versions also emit
# "App Hanging". The frontend's ANR-rate query (`static/app/views/projectDetail/utils.tsx`) selects
# on exactly the two fatal spellings, which is why conflating fatal with non-fatal skews that
# number.
_APP_HANG_RE = re.compile(r"^(?P<fatal>fatal\s+)?app\s+hang(ing)?\b", re.IGNORECASE)


class MismatchReason(StrEnum):
    """
    Why two exception types were considered different, or — for the non-rejecting values — why we
    declined to act on the difference. Used as a metrics tag, so keep the set small and bounded.
    """

    # Rejections
    APP_HANG_FATALITY = "app_hang_fatality"
    DISTINCT_TYPE_NAMES = "distinct_type_names"

    # Accepted-but-noted
    APP_HANG_OTHER = "app_hang_other"
    CONTAINS_WHITESPACE = "contains_whitespace"
    PARAMETERIZES_EQUAL = "parameterizes_equal"
    GENERIC_PLACEHOLDER = "generic_placeholder"
    UNSTABLE_PLATFORM = "unstable_platform"


def _is_app_hang(error_type: str) -> bool:
    return _APP_HANG_RE.match(error_type) is not None


def _is_fatal_app_hang(error_type: str) -> bool:
    match = _APP_HANG_RE.match(error_type)
    return match is not None and match.group("fatal") is not None


def _app_hang_mismatch(event_type: str, parent_type: str) -> MismatchReason:
    """
    Classify a mismatch between two app-hang types.

    Fatality is the one dimension we're confident about: a fatal hang means the app was terminated
    while a non-fatal one means it recovered, so they belong in separate groups regardless of how
    similar their stacktraces are. The blocked/non-fully-blocked dimension and the
    "hang"/"hanging" spelling difference are *not* settled — pending confirmation from the native
    SDK team on which combinations describe the same underlying problem — so those are accepted and
    logged.
    """
    if _is_fatal_app_hang(event_type) != _is_fatal_app_hang(parent_type):
        return MismatchReason.APP_HANG_FATALITY

    return MismatchReason.APP_HANG_OTHER


def _distinct_stable_type_names(
    event_type: str, parent_type: str, platform: str | None
) -> MismatchReason:
    """
    Classify a mismatch between two non-app-hang types, rejecting only when the difference is in the
    stable part of a hand-written type name.

    Three conditions must all hold to reject, each ruling out a way the difference could be an
    artifact rather than a real difference in kind:

    - **No whitespace on either side.** A whitespace-free string is an identifier the SDK read off a
      real type. Once there's whitespace we're likely looking at a message that got stuffed into the
      `type` field, where the difference may be a severity prefix or an appended value.
    - **Parameterization is a no-op and they still differ.** This is what keeps runtime-generated
      names out: `Foo$$Lambda$14/0x...` vs `Foo$$Lambda$27/0x...` and `Error_a3f2b1` vs
      `Error_c9d4e7` both collapse to a single string once variable data is replaced, so their
      difference *is* the variable data. Note that this subsumes the `Namespace::Type` case — `::`
      contains no whitespace and doesn't parameterize, so `RestClient::BadRequest` vs
      `RestClient::NotFound` is rejected without needing a rule of its own.
    - **Neither side is the bare placeholder.** See ``GENERIC_TYPE_PLACEHOLDER``.

    Platform is checked by the caller (see ``PLATFORMS_WITH_STABLE_TYPE_NAMES``).
    """
    if platform not in PLATFORMS_WITH_STABLE_TYPE_NAMES:
        return MismatchReason.UNSTABLE_PLATFORM

    if GENERIC_TYPE_PLACEHOLDER in (event_type, parent_type):
        return MismatchReason.GENERIC_PLACEHOLDER

    if any(char.isspace() for char in event_type + parent_type):
        return MismatchReason.CONTAINS_WHITESPACE

    if parameterizer.parameterize(event_type) == parameterizer.parameterize(parent_type):
        return MismatchReason.PARAMETERIZES_EQUAL

    return MismatchReason.DISTINCT_TYPE_NAMES


REJECTING_REASONS = frozenset(
    [MismatchReason.APP_HANG_FATALITY, MismatchReason.DISTINCT_TYPE_NAMES]
)


def classify_exception_type_mismatch(
    event_type: str, parent_type: str, platform: str | None
) -> MismatchReason:
    """
    Categorize why two differing exception types differ.

    Callers should reject the Seer match when the returned reason is in ``REJECTING_REASONS``, and
    accept (but log) otherwise. Assumes the two types are already known to differ.
    """
    if _is_app_hang(event_type) and _is_app_hang(parent_type):
        return _app_hang_mismatch(event_type, parent_type)

    return _distinct_stable_type_names(event_type, parent_type, platform)

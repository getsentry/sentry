from sentry.types.superuser import (
    SuperuserAccess,
    from_viewer_context_superuser,
    to_viewer_context_superuser,
)
from sentry.viewer_context import SuperuserAccess as ViewerContextSuperuserAccess


def test_viewer_context_superuser_roundtrip() -> None:
    converted = to_viewer_context_superuser(SuperuserAccess(expires_at=123))
    assert converted == ViewerContextSuperuserAccess(expires_at=123)
    assert from_viewer_context_superuser(converted) == SuperuserAccess(expires_at=123)


def test_viewer_context_superuser_none() -> None:
    assert to_viewer_context_superuser(None) is None
    assert from_viewer_context_superuser(None) is None

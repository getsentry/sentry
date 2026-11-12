from datetime import timedelta

from pydantic import BaseModel, StrictInt
from sentry_viewercontext import SuperuserAccess as ViewerContextSuperuserAccess

SUPERUSER_ACCESS_TTL = timedelta(minutes=5)


class SuperuserAccess(BaseModel):
    """Read-only elevation for the ViewerContext's human actor and organization."""

    expires_at: StrictInt

    class Config:
        frozen = True


def from_viewer_context_superuser(
    superuser: ViewerContextSuperuserAccess | None,
) -> SuperuserAccess | None:
    """Convert the shared library's elevation into the Pydantic model RPC and agent tokens use."""
    if superuser is None:
        return None
    return SuperuserAccess(expires_at=superuser.expires_at)


def to_viewer_context_superuser(
    superuser: SuperuserAccess | None,
) -> ViewerContextSuperuserAccess | None:
    """Convert Pydantic elevation into the shared library's type for a ViewerContext."""
    if superuser is None:
        return None
    return ViewerContextSuperuserAccess(expires_at=superuser.expires_at)

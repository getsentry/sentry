from datetime import timedelta

from pydantic import BaseModel, StrictInt

SUPERUSER_ACCESS_TTL = timedelta(minutes=5)


class SuperuserAccess(BaseModel):
    """Read-only elevation for the ViewerContext's human actor and organization."""

    expires_at: StrictInt

    class Config:
        frozen = True

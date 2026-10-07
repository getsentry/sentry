from datetime import timedelta

from pydantic import BaseModel, StrictBool, StrictInt

SUPERUSER_ACCESS_TTL = timedelta(minutes=5)


class SuperuserAccess(BaseModel):
    expires_at: StrictInt
    read_only: StrictBool

    class Config:
        frozen = True

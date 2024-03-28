import pydantic


class RpcOrganizationSlugReservation(pydantic.BaseModel):
    id: int
    organization_id: int
    user_id: int | None
    slug: str
    region_name: str
    reservation_type: int


class RpcOrganizationSlugBulkReservation(pydantic.BaseModel):
    organization_id: int
    slug: str

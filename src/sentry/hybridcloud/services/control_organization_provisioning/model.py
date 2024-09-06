from sentry.hybridcloud.rpc import RpcModel


class RpcOrganizationSlugReservation(RpcModel):
    id: int
    organization_id: int
    user_id: int | None
    slug: str
    region_name: str
    reservation_type: int

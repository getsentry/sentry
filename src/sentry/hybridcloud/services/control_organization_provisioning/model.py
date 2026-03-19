from sentry.hybridcloud.rpc import AcceptCellNameMixin, RpcModel


class RpcOrganizationSlugReservation(RpcModel, AcceptCellNameMixin):
    id: int
    organization_id: int
    user_id: int | None
    slug: str
    region_name: str
    reservation_type: int

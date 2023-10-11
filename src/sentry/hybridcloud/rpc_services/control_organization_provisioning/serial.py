from sentry.hybridcloud.rpc_services.control_organization_provisioning import (
    RpcOrganizationSlugReservation,
)
from sentry.models.organizationslugreservation import OrganizationSlugReservation


def serialize_slug_reservation(
    slug_reservation: OrganizationSlugReservation,
) -> RpcOrganizationSlugReservation:
    return RpcOrganizationSlugReservation(
        id=slug_reservation.id,
        organization_id=slug_reservation.organization_id,
        slug=slug_reservation.slug,
        region_name=slug_reservation.region_name,
        user_id=slug_reservation.user_id,
        reservation_type=slug_reservation.reservation_type,
    )

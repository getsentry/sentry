from sentry.models.organizationslugreservation import OrganizationSlugReservation
from sentry.services.hybrid_cloud.organization_provisioning import RpcOrganizationSlugReservation


def serialize_slug_reservation(
    slug_reservation: OrganizationSlugReservation,
) -> RpcOrganizationSlugReservation:
    return RpcOrganizationSlugReservation(
        organization_id=slug_reservation.organization_id,
        slug=slug_reservation.slug,
        region_name=slug_reservation.region_name,
        user_id=slug_reservation.user_id,
    )

import pydantic

# TODO(Gabe): Remove this once GetSentry has been updated to use new model file in org provisioning
from sentry.services.organization.model import (  # noqa
    OrganizationOptions,
    OrganizationProvisioningOptions,
    PostProvisionOptions,
)


class RpcOrganizationSlugReservation(pydantic.BaseModel):
    id: int
    organization_id: int
    user_id: int
    slug: str
    region_name: str
    reservation_type: int

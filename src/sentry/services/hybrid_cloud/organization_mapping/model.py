# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime
from typing import Optional

from django.utils import timezone
from pydantic.fields import Field
from typing_extensions import TypedDict

from sentry.models import OrganizationStatus
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary


class RpcOrganizationMapping(RpcOrganizationSummary):
    region_name: str = ""
    date_created: datetime = Field(default_factory=timezone.now)
    verified: bool = False
    customer_id: Optional[str] = None
    status: Optional[OrganizationStatus] = None


class RpcOrganizationMappingUpdate(TypedDict, total=False):
    """A set of values to be updated on an OrganizationMapping.

    An absent key indicates that the attribute should not be updated.
    """

    name: str
    status: OrganizationStatus
    slug: str
    region_name: str


class RpcOrganizationMappingBillingCustomerUpdate(TypedDict):
    customer_id: Optional[str]

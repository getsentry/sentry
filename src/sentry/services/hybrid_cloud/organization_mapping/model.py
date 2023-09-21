# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime
from typing import Optional, Tuple

from django.utils import timezone
from pydantic.fields import Field

from sentry.services.hybrid_cloud import RpcModel
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary


class RpcOrganizationMapping(RpcOrganizationSummary):
    region_name: str = ""
    date_created: datetime = Field(default_factory=timezone.now)
    verified: bool = False
    customer_id: Optional[str] = None
    status: Optional[int] = None


class RpcOrganizationMappingUpdate(RpcModel):
    name: str = ""
    status: int = 0
    slug: str = ""
    region_name: str = ""
    # When not set, no change to customer id performed,
    # when set with a tuple, the customer_id set to either None or the string
    # that is the first element.
    customer_id: Optional[Tuple[Optional[str]]] = None
    requires_2fa: bool = False

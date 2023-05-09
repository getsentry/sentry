# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime
from typing import Optional

from django.utils import timezone
from pydantic.fields import Field
from typing_extensions import TypedDict

from sentry.services.hybrid_cloud import RpcModel


class RpcOrganizationMapping(RpcModel):
    organization_id: int = -1
    slug: str = ""
    name: str = ""
    region_name: str = ""
    date_created: datetime = Field(default_factory=timezone.now)
    verified: bool = False
    customer_id: Optional[str] = None


class RpcOrganizationMappingUpdate(TypedDict):
    """A set of values to be updated on an OrganizationMapping.

    An absent key indicates that the attribute should not be updated. (Compare to a
    `"customer_id": None` entry, which indicates that `customer_id` should be
    overwritten with a null value.)
    """

    name: str
    customer_id: Optional[str]

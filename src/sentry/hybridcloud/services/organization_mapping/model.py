# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime

from django.utils import timezone
from pydantic.fields import Field

from sentry.hybridcloud.rpc import RpcModel
from sentry.organizations.services.organization import (
    RpcOrganizationMappingFlags,
    RpcOrganizationSummary,
)


class RpcOrganizationMapping(RpcOrganizationSummary):
    region_name: str = ""
    date_created: datetime = Field(default_factory=timezone.now)
    verified: bool = False
    customer_id: str | None = None
    status: int | None = None
    flags: RpcOrganizationMappingFlags = Field(default_factory=RpcOrganizationMappingFlags)


class CustomerId(RpcModel):
    value: str | None


class RpcOrganizationMappingUpdate(RpcModel):
    name: str = ""
    status: int = 0
    slug: str = ""
    region_name: str = ""
    # When not set, no change to customer id performed,
    # when set with a CustomerId, the customer_id set to either None or string
    customer_id: CustomerId | None = None
    requires_2fa: bool = False
    early_adopter: bool = False
    codecov_access: bool = False
    disable_shared_issues: bool = False
    allow_joinleave: bool = False
    disable_new_visibility_features: bool = False
    enhanced_privacy: bool = False
    require_email_verification: bool = False
    disable_member_project_creation: bool = False
    prevent_superuser_access: bool = False
    disable_member_invite: bool = False

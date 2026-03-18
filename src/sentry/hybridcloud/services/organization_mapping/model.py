# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime

from django.utils import timezone
from pydantic import root_validator
from pydantic.fields import Field

from sentry.hybridcloud.rpc import RpcModel
from sentry.organizations.services.organization import (
    RpcOrganizationMappingFlags,
    RpcOrganizationSummary,
)


class RpcOrganizationMapping(RpcOrganizationSummary):
    # TODO(cells): rename to cell_name once `cell_name` is no longer being sent
    region_name: str = ""
    date_created: datetime = Field(default_factory=timezone.now)
    verified: bool = False
    customer_id: str | None = None
    status: int | None = None
    flags: RpcOrganizationMappingFlags = Field(default_factory=RpcOrganizationMappingFlags)

    # TODO(cells): remove once region_name -> cell_name rename is complete
    @property
    def cell_name(self) -> str:
        return self.region_name

    # TODO(cells): temporary code to accept `cell_name` on the wire before property rename is complete
    @root_validator(pre=True)
    @classmethod
    def _accept_cell_name(cls, values: dict) -> dict:
        if "cell_name" in values and "region_name" not in values:
            values["region_name"] = values.pop("cell_name")
        return values


class CustomerId(RpcModel):
    value: str | None


class RpcOrganizationMappingUpdate(RpcModel):
    name: str = ""
    status: int = 0
    slug: str = ""
    # TODO(cells): rename to cell_name once `cell_name` is no longer being sent
    region_name: str = ""

    # TODO(cells): remove once region_name -> cell_name rename is complete
    @property
    def cell_name(self) -> str:
        return self.region_name

    # TODO(cells): temporary code to accept `cell_name` on the wire before property rename is complete
    @root_validator(pre=True)
    @classmethod
    def _accept_cell_name(cls, values: dict) -> dict:
        if "cell_name" in values and "region_name" not in values:
            values["region_name"] = values.pop("cell_name")
        return values

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

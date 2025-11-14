# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import int
from sentry.hybridcloud.rpc import RpcModel


class RpcOrganizationConsentStatus(RpcModel):
    """
    Represents consent status for an organization.
    """

    organization_id: int
    has_consent: bool

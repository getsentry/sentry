from dataclasses import dataclass
from typing import Optional

from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team


@dataclass
class OrganizationAndMemberCreationResult:
    organization: Organization
    org_member: OrganizationMember
    team: Optional[Team]

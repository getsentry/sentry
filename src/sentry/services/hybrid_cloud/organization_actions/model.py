from dataclasses import dataclass
from typing import Optional

from sentry.models import Organization, OrganizationMember, Team


@dataclass
class OrganizationAndMemberCreationResult:
    organization: Organization
    org_member: OrganizationMember
    team: Optional[Team]

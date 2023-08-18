from dataclasses import dataclass

from sentry.models import Organization, OrganizationMember, Team


@dataclass
class OrganizationAndMemberCreationResult:
    organization: Organization
    org_member: OrganizationMember
    team: Team

from scm.manager import SourceCodeManager
from scm.types import Referrer

from sentry import features
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.organizations.services.organization import organization_service
from sentry.scm import factory

SCM_MIGRATION_FLAG = "organizations:integrations-scm-migration"


def manager_for_repository(repository: Repository, referrer: Referrer) -> SourceCodeManager:
    return factory.new(repository.organization_id, repository.id, referrer)


def use_scm_for_org(organization: Organization) -> bool:
    return features.has(SCM_MIGRATION_FLAG, organization)


def use_scm_for_org_id(organization_id: int) -> bool:
    org_context = organization_service.get_organization_by_id(
        id=organization_id, include_projects=False, include_teams=False
    )
    if org_context is None:
        return False
    return features.has(SCM_MIGRATION_FLAG, org_context.organization)

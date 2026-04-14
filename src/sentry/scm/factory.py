from scm.manager import SourceCodeManager
from scm.types import Referrer, RepositoryId

from sentry.scm.private.helpers import fetch_repository, fetch_service_provider, record_count_metric


def new(organization_id: int, repository_id: RepositoryId, referrer: Referrer) -> SourceCodeManager:
    """Return a new SourceCodeManager instance."""
    return SourceCodeManager.make_from_repository_id(
        organization_id,
        repository_id,
        referrer=referrer,
        fetch_repository=fetch_repository,
        fetch_provider=fetch_service_provider,
        record_count=record_count_metric,
    )

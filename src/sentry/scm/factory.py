from scm.manager import SourceCodeManager
from scm.types import Referrer, RepositoryId

from sentry.scm.private.helpers import make_fetchers, record_count_metric


def new(organization_id: int, repository_id: RepositoryId, referrer: Referrer) -> SourceCodeManager:
    """Return a new SourceCodeManager instance."""
    fetchers = make_fetchers()
    return SourceCodeManager.make_client(
        organization_id,
        repository_id,
        referrer=referrer,
        fetch_repository=fetchers.fetch_repository,
        fetch_provider=fetchers.fetch_provider,
        record_count=record_count_metric,
    )

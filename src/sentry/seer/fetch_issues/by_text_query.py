from typing import int
from datetime import UTC, datetime, timedelta

from django.contrib.auth.models import AnonymousUser

from sentry import search
from sentry.api.event_search import SearchFilter
from sentry.api.helpers.group_index.index import parse_and_convert_issue_search_query
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.fetch_issues import utils
from sentry.snuba.referrer import Referrer

SORT_BY_DEFAULT = "new"


def _fetch_issues_from_repo_projects(
    repo_projects: utils.RepoProjects,
    query: str,
    sort_by: str = SORT_BY_DEFAULT,
    limit: int = utils.MAX_NUM_ISSUES_DEFAULT,
    max_num_days_ago: int = utils.MAX_NUM_DAYS_AGO_DEFAULT,
) -> list[Group]:
    date_to = datetime.now(UTC)
    date_from = date_to - timedelta(days=max_num_days_ago)

    organization = Organization.objects.get(id=repo_projects.organization_id)
    search_filters = parse_and_convert_issue_search_query(
        query, organization, repo_projects.projects, environments=None, user=AnonymousUser()
    )
    search_filters_only = [
        search_filter for search_filter in search_filters if isinstance(search_filter, SearchFilter)
    ]
    results_cursor = search.backend.query(
        projects=repo_projects.projects,
        date_from=date_from,
        date_to=date_to,
        search_filters=search_filters_only,
        sort_by=sort_by,
        limit=limit,
        referrer=Referrer.SEER_RPC,
    )
    return list(results_cursor)


@utils.handle_fetch_issues_exceptions
def fetch_issues(
    organization_id: int,
    provider: str,
    external_id: str,
    query: str,
    sort_by: str = SORT_BY_DEFAULT,
    limit: int = utils.MAX_NUM_ISSUES_DEFAULT,
    max_num_days_ago: int = utils.MAX_NUM_DAYS_AGO_DEFAULT,
    run_id: int | None = None,
) -> utils.SeerResponse | utils.SeerResponseError:
    """
    Fetch issues whose message contains `query`.
    """
    repo_projects = utils.get_repo_and_projects(
        organization_id, provider, external_id, run_id=run_id
    )
    groups = _fetch_issues_from_repo_projects(
        repo_projects,
        query,
        sort_by=sort_by,
        limit=limit,
        max_num_days_ago=max_num_days_ago,
    )
    return utils.bulk_serialize_for_seer(groups)

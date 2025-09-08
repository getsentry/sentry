from datetime import UTC, datetime, timedelta

from django.db.models.expressions import RawSQL

from sentry.models.group import Group
from sentry.seer.fetch_issues import utils


def _fetch_issues_from_repo_projects(
    repo_projects: utils.RepoProjects,
    exception_type: str,
    max_num_issues: int = utils.MAX_NUM_ISSUES_DEFAULT,
    num_days_ago: int = utils.MAX_NUM_DAYS_AGO_DEFAULT,
) -> list[Group]:
    project_ids = [project.id for project in repo_projects.projects]
    date_threshold = datetime.now(tz=UTC) - timedelta(days=num_days_ago)
    # Using raw SQL since data is LegacyTextJSONField which can't be filtered with Django ORM
    query_set = (
        Group.objects.annotate(metadata_type=RawSQL("(data::json -> 'metadata' ->> 'type')", []))
        .filter(
            metadata_type=exception_type,
            project_id__in=project_ids,
            last_seen__gte=date_threshold,
        )
        .order_by("-last_seen")[:max_num_issues]
    )
    return list(query_set)


@utils.handle_fetch_issues_exceptions
def fetch_issues(
    organization_id: int,
    provider: str,
    external_id: str,
    exception_type: str,
    max_num_issues: int = utils.MAX_NUM_ISSUES_DEFAULT,
    num_days_ago: int = utils.MAX_NUM_DAYS_AGO_DEFAULT,
    run_id: int | None = None,
) -> utils.SeerResponse | utils.SeerResponseError:
    repo_projects = utils.get_repo_and_projects(
        organization_id, provider, external_id, run_id=run_id
    )
    groups = _fetch_issues_from_repo_projects(
        repo_projects,
        exception_type,
        max_num_issues=max_num_issues,
        num_days_ago=num_days_ago,
    )
    return utils.bulk_serialize_for_seer(groups)

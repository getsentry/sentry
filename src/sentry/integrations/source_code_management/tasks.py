import logging

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.commit_context import (
    MAX_SUSPECT_COMMITS,
    MERGED_PR_METRICS_BASE,
    CommitContextIntegration,
    _debounce_pr_comment_cache_key,
    _pr_comment_log,
)
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils import metrics
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.source_code_management.tasks.pr_comment_workflow",
    namespace=integrations_tasks,
    processing_deadline_duration=45,
    silo_mode=SiloMode.REGION,
)
def pr_comment_workflow(pr_id: int, project_id: int) -> None:
    cache_key = _debounce_pr_comment_cache_key(pullrequest_id=pr_id)

    try:
        pr = PullRequest.objects.get(id=pr_id)
        assert isinstance(pr, PullRequest)
    except PullRequest.DoesNotExist:
        cache.delete(cache_key)
        logger.info(_pr_comment_log(integration_name="source_code_management", suffix="pr_missing"))
        return

    try:
        organization = Organization.objects.get_from_cache(id=pr.organization_id)
        assert isinstance(organization, Organization)
    except Organization.DoesNotExist:
        cache.delete(cache_key)
        logger.info(
            _pr_comment_log(integration_name="source_code_management", suffix="org_missing")
        )
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration="source_code_management", key="error"),
            tags={"type": "missing_org"},
        )
        return

    try:
        repo = Repository.objects.get(id=pr.repository_id)
        assert isinstance(repo, Repository)
    except Repository.DoesNotExist:
        cache.delete(cache_key)
        logger.info(
            _pr_comment_log(integration_name="source_code_management", suffix="repo_missing"),
            extra={"organization_id": organization.id},
        )
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration="source_code_management", key="error"),
            tags={"type": "missing_repo"},
        )
        return

    integration = integration_service.get_integration(
        integration_id=repo.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        cache.delete(cache_key)
        logger.info(
            _pr_comment_log(
                integration_name="source_code_management", suffix="integration_missing"
            ),
            extra={"organization_id": organization.id},
        )
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration="source_code_management", key="error"),
            tags={"type": "missing_integration"},
        )
        return

    installation = integration.get_installation(organization_id=organization.id)
    assert isinstance(installation, CommitContextIntegration)

    integration_name = installation.integration_name
    pr_comment_workflow = installation.get_pr_comment_workflow()

    # cap to 1000 issues in which the merge commit is the suspect commit
    issue_ids = pr_comment_workflow.get_issue_ids_from_pr(pr=pr, limit=MAX_SUSPECT_COMMITS)

    if not OrganizationOption.objects.get_value(
        organization=organization,
        key=pr_comment_workflow.organization_option_key,
        default=True,
    ):
        logger.info(
            _pr_comment_log(integration_name=integration_name, suffix="option_missing"),
            extra={"organization_id": organization.id},
        )
        return

    try:
        project = Project.objects.get_from_cache(id=project_id)
        assert isinstance(project, Project)
    except Project.DoesNotExist:
        cache.delete(cache_key)
        logger.info(
            _pr_comment_log(integration_name=integration_name, suffix="project_missing"),
            extra={"organization_id": organization.id},
        )
        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration=integration_name, key="error"),
            tags={"type": "missing_project"},
        )
        return

    top_5_issues = pr_comment_workflow.get_top_5_issues_by_count(
        issue_ids=issue_ids, project=project
    )
    if not top_5_issues:
        logger.info(
            _pr_comment_log(integration_name=integration_name, suffix="no_issues"),
            extra={"organization_id": organization.id, "pr_id": pr.id},
        )
        cache.delete(cache_key)
        return

    top_5_issue_ids = [issue["group_id"] for issue in top_5_issues]

    comment_body = pr_comment_workflow.get_comment_body(issue_ids=top_5_issue_ids)

    top_24_issue_ids = issue_ids[:24]  # 24 is the P99 for issues-per-PR

    comment_data = pr_comment_workflow.get_comment_data(
        organization=organization,
        repo=repo,
        pr=pr,
        comment_body=comment_body,
        issue_ids=top_24_issue_ids,
    )

    try:
        installation.create_or_update_comment(
            repo=repo,
            pr=pr,
            comment_data=comment_data,
            issue_list=top_24_issue_ids,
            metrics_base=MERGED_PR_METRICS_BASE,
        )
    except ApiError as e:
        cache.delete(cache_key)

        if installation.on_create_or_update_comment_error(
            api_error=e, metrics_base=MERGED_PR_METRICS_BASE
        ):
            return

        metrics.incr(
            MERGED_PR_METRICS_BASE.format(integration=integration_name, key="error"),
            tags={"type": "api_error"},
        )
        raise

import itertools
import logging
from typing import Any

from sentry.constants import EXTENSION_LANGUAGE_MAP, ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.commit_context import (
    MAX_SUSPECT_COMMITS,
    MERGED_PR_METRICS_BASE,
    OPEN_PR_METRICS_BASE,
    CommitContextIntegration,
    _debounce_pr_comment_cache_key,
    _open_pr_comment_log,
    _pr_comment_log,
)
from sentry.integrations.source_code_management.language_parsers import (
    get_patch_parsers_for_organization,
)
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.pullrequest import CommentType, PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils import metrics
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.source_code_management.tasks.pr_comment_workflow",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
        processing_deadline_duration=45,
    ),
)
def pr_comment_workflow(pr_id: int, project_id: int):
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


@instrumented_task(
    name="sentry.integrations.source_code_management.tasks.open_pr_comment_workflow",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
        processing_deadline_duration=150,
    ),
)
def open_pr_comment_workflow(pr_id: int) -> None:
    logger.info(
        _open_pr_comment_log(integration_name="source_code_management", suffix="start_workflow")
    )

    # CHECKS
    # check PR exists to get PR key
    try:
        pull_request = PullRequest.objects.get(id=pr_id)
    except PullRequest.DoesNotExist:
        logger.info(
            _open_pr_comment_log(integration_name="source_code_management", suffix="pr_missing")
        )
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="source_code_management", key="error"),
            tags={"type": "missing_pr"},
        )
        return

    # check org option
    org_id = pull_request.organization_id
    try:
        organization = Organization.objects.get_from_cache(id=org_id)
        assert isinstance(organization, Organization)
    except Organization.DoesNotExist:
        logger.exception(
            _open_pr_comment_log(integration_name="source_code_management", suffix="org_missing")
        )
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="source_code_management", key="error"),
            tags={"type": "missing_org"},
        )
        return

    # check PR repo exists to get repo name
    try:
        repo = Repository.objects.get(id=pull_request.repository_id)
    except Repository.DoesNotExist:
        logger.info(
            _open_pr_comment_log(integration_name="source_code_management", suffix="repo_missing"),
            extra={"organization_id": organization.id},
        )
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="source_code_management", key="error"),
            tags={"type": "missing_repo"},
        )
        return

    # check integration exists to hit Github API with client
    integration = integration_service.get_integration(
        integration_id=repo.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        logger.info(
            _open_pr_comment_log(
                integration_name="source_code_management", suffix="integration_missing"
            ),
            extra={"organization_id": organization.id},
        )
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="source_code_management", key="error"),
            tags={"type": "missing_integration"},
        )
        return

    installation = integration.get_installation(organization_id=organization.id)
    assert isinstance(installation, CommitContextIntegration)

    integration_name = installation.integration_name

    # TODO(jianyuan): Remove this once we have implemented the new open_pr_comment_workflow for GH Enterprise
    try:
        open_pr_comment_workflow = installation.get_open_pr_comment_workflow()
    except NotImplementedError:
        logger.info(
            _open_pr_comment_log(
                integration_name="source_code_management", suffix="not_implemented"
            )
        )
        return

    # CREATING THE COMMENT

    # fetch the files in the PR and determine if it is safe to comment
    pullrequest_files = open_pr_comment_workflow.get_pr_files_safe_for_comment(
        repo=repo, pr=pull_request
    )

    issue_table_contents = {}
    top_issues_per_file = []

    patch_parsers = get_patch_parsers_for_organization(organization)

    file_extensions = set()
    # fetch issues related to the files
    for file in pullrequest_files:
        projects, sentry_filenames = (
            open_pr_comment_workflow.get_projects_and_filenames_from_source_file(
                organization=organization, repo=repo, pr_filename=file.filename
            )
        )
        if not len(projects) or not len(sentry_filenames):
            continue

        file_extension = file.filename.split(".")[-1]
        logger.info(
            _open_pr_comment_log(integration_name=integration_name, suffix="file_extension"),
            extra={
                "organization_id": org_id,
                "repository_id": repo.id,
                "file_name": file.filename,
                "extension": file_extension,
            },
        )

        language_parser = patch_parsers.get(file.filename.split(".")[-1], None)
        if not language_parser:
            logger.info(
                _open_pr_comment_log(integration_name=integration_name, suffix="missing_parser"),
                extra={"file_name": file.filename, "extension": file_extension},
            )
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(integration=integration_name, key="missing_parser"),
                tags={"file_name": file.filename, "extension": file_extension},
            )
            continue

        function_names = language_parser.extract_functions_from_patch(file.patch)

        if file_extension == "py":
            logger.info(
                _open_pr_comment_log(integration_name=integration_name, suffix="python"),
                extra={
                    "organization_id": org_id,
                    "repository_id": repo.id,
                    "file_name": file.filename,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if file_extension in ["js", "jsx"]:
            logger.info(
                _open_pr_comment_log(integration_name=integration_name, suffix="javascript"),
                extra={
                    "organization_id": org_id,
                    "repository_id": repo.id,
                    "file_name": file.filename,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if file_extension == ["php"]:
            logger.info(
                _open_pr_comment_log(integration_name=integration_name, suffix="php"),
                extra={
                    "organization_id": org_id,
                    "repository_id": repo.id,
                    "file_name": file.filename,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if file_extension == ["rb"]:
            logger.info(
                _open_pr_comment_log(integration_name=integration_name, suffix="ruby"),
                extra={
                    "organization_id": org_id,
                    "repository_id": repo.id,
                    "file_name": file.filename,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if file_extension == ["cs"]:
            logger.info(
                _open_pr_comment_log(integration_name=integration_name, suffix="csharp"),
                extra={
                    "organization_id": org_id,
                    "repository_id": repo.id,
                    "file_name": file.filename,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if file_extension == ["go"]:
            logger.info(
                _open_pr_comment_log(integration_name=integration_name, suffix="go"),
                extra={
                    "organization_id": org_id,
                    "repository_id": repo.id,
                    "file_name": file.filename,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if not len(function_names):
            continue

        top_issues = open_pr_comment_workflow.get_top_5_issues_by_count_for_file(
            projects=list(projects),
            sentry_filenames=list(sentry_filenames),
            function_names=list(function_names),
        )
        if not len(top_issues):
            continue

        top_issues_per_file.append(top_issues)
        file_extensions.add(file_extension)

        issue_table_contents[file.filename] = open_pr_comment_workflow.get_issue_table_contents(
            top_issues
        )

    if not len(issue_table_contents):
        logger.info(_open_pr_comment_log(integration_name=integration_name, suffix="no_issues"))
        # don't leave a comment if no issues for files in PR
        metrics.incr(OPEN_PR_METRICS_BASE.format(integration=integration_name, key="no_issues"))
        return

    # format issues per file into comment
    issue_tables = []
    first_table = True
    for file in pullrequest_files:
        pr_filename = file.filename
        issue_table_content = issue_table_contents.get(pr_filename, None)

        if issue_table_content is None:
            continue

        if first_table:
            issue_table = open_pr_comment_workflow.format_issue_table(
                diff_filename=pr_filename,
                issues=issue_table_content,
                patch_parsers=patch_parsers,
                toggle=False,
            )
            first_table = False
        else:
            # toggle all tables but the first one
            issue_table = open_pr_comment_workflow.format_issue_table(
                diff_filename=pr_filename,
                issues=issue_table_content,
                patch_parsers=patch_parsers,
                toggle=True,
            )

        issue_tables.append(issue_table)

    comment_body = open_pr_comment_workflow.format_open_pr_comment(issue_tables)

    # list all issues in the comment
    issue_list: list[dict[str, Any]] = list(itertools.chain.from_iterable(top_issues_per_file))
    issue_id_list: list[int] = [issue["group_id"] for issue in issue_list]

    # pick one language from the list of languages in the PR for analytics
    languages = [
        EXTENSION_LANGUAGE_MAP[extension]
        for extension in file_extensions
        if extension in EXTENSION_LANGUAGE_MAP
    ]
    language = languages[0] if len(languages) else "not found"

    comment_data = open_pr_comment_workflow.get_comment_data(comment_body=comment_body)

    try:
        installation.create_or_update_comment(
            repo=repo,
            pr=pull_request,
            comment_data=comment_data,
            issue_list=issue_id_list,
            comment_type=CommentType.OPEN_PR,
            metrics_base=OPEN_PR_METRICS_BASE,
            language=language,
        )
    except ApiError as e:
        if installation.on_create_or_update_comment_error(
            api_error=e, metrics_base=OPEN_PR_METRICS_BASE
        ):
            return

        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration=integration_name, key="error"),
            tags={"type": "api_error"},
        )
        raise

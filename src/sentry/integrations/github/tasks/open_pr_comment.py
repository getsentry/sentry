from __future__ import annotations

import itertools
import logging
from typing import Any

from sentry.constants import EXTENSION_LANGUAGE_MAP, ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.commit_context import (
    OPEN_PR_METRICS_BASE,
    CommitContextIntegration,
)
from sentry.integrations.source_code_management.language_parsers import PATCH_PARSERS
from sentry.models.organization import Organization
from sentry.models.pullrequest import CommentType, PullRequest
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.github.tasks.open_pr_comment_workflow",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
    ),
)
def open_pr_comment_workflow(pr_id: int) -> None:
    logger.info("github.open_pr_comment.start_workflow")

    # CHECKS
    # check PR exists to get PR key
    try:
        pr = PullRequest.objects.get(id=pr_id)
        assert isinstance(pr, PullRequest)
    except PullRequest.DoesNotExist:
        logger.info("github.open_pr_comment.pr_missing")
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_pr"},
        )
        return

    # check org option
    try:
        organization = Organization.objects.get_from_cache(id=pr.organization_id)
        assert isinstance(organization, Organization)
    except Organization.DoesNotExist:
        logger.exception("github.open_pr_comment.org_missing")
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_org"},
        )
        return

    # check PR repo exists to get repo name
    try:
        repo = Repository.objects.get(id=pr.repository_id)
        assert isinstance(repo, Repository)
    except Repository.DoesNotExist:
        logger.info(
            "github.open_pr_comment.repo_missing", extra={"organization_id": organization.id}
        )
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_repo"},
        )
        return

    # check integration exists to hit Github API with client
    integration = integration_service.get_integration(
        integration_id=repo.integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        logger.info(
            "github.open_pr_comment.integration_missing", extra={"organization_id": organization.id}
        )
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "missing_integration"},
        )
        return

    installation = integration.get_installation(organization_id=organization.id)
    assert isinstance(installation, CommitContextIntegration)

    # CREATING THE COMMENT

    # fetch the files in the PR and determine if it is safe to comment
    pr_files = installation.get_pr_files_safe_for_comment(repo=repo, pr=pr)

    if len(pr_files) == 0:
        logger.info(
            "github.open_pr_comment.not_safe_for_comment", extra={"file_count": len(pr_files)}
        )
        metrics.incr(
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "unsafe_for_comment"},
        )
        return

    pullrequest_files = installation.get_pr_files(pr_files)

    issue_table_contents = {}
    top_issues_per_file = []

    patch_parsers = PATCH_PARSERS
    # NOTE: if we are testing beta patch parsers, add check here

    file_extensions = set()
    # fetch issues related to the files
    for file in pullrequest_files:
        projects, sentry_filenames = installation.get_projects_and_filenames_from_source_file(
            organization=organization, repo=repo, pr_filename=file.filename
        )
        if not len(projects) or not len(sentry_filenames):
            continue

        file_extension = file.filename.split(".")[-1]
        logger.info(
            "github.open_pr_comment.file_extension",
            extra={
                "organization_id": organization.id,
                "repository_id": repo.id,
                "extension": file_extension,
            },
        )

        language_parser = patch_parsers.get(file.filename.split(".")[-1], None)
        if not language_parser:
            logger.info(
                "github.open_pr_comment.missing_parser", extra={"extension": file_extension}
            )
            metrics.incr(
                OPEN_PR_METRICS_BASE.format(integration="github", key="missing_parser"),
                tags={"extension": file_extension},
            )
            continue

        function_names = language_parser.extract_functions_from_patch(file.patch)

        if file_extension in ["js", "jsx"]:
            logger.info(
                "github.open_pr_comment.javascript",
                extra={
                    "organization_id": organization.id,
                    "repository_id": repo.id,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if file_extension == ["php"]:
            logger.info(
                "github.open_pr_comment.php",
                extra={
                    "organization_id": organization.id,
                    "repository_id": repo.id,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if file_extension == ["rb"]:
            logger.info(
                "github.open_pr_comment.ruby",
                extra={
                    "organization_id": organization.id,
                    "repository_id": repo.id,
                    "extension": file_extension,
                    "has_function_names": bool(function_names),
                },
            )

        if not len(function_names):
            continue

        top_issues = installation.get_top_5_issues_by_count_for_file(
            list(projects), list(sentry_filenames), list(function_names)
        )
        if not len(top_issues):
            continue

        top_issues_per_file.append(top_issues)
        file_extensions.add(file_extension)

        issue_table_contents[file.filename] = installation.get_issue_table_contents(top_issues)

    if not len(issue_table_contents):
        logger.info("github.open_pr_comment.no_issues")
        # don't leave a comment if no issues for files in PR
        metrics.incr(OPEN_PR_METRICS_BASE.format(integration="github", key="no_issues"))
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
            issue_table = installation.format_issue_table(
                pr_filename, issue_table_content, patch_parsers, toggle=False
            )
            first_table = False
        else:
            # toggle all tables but the first one
            issue_table = installation.format_issue_table(
                pr_filename, issue_table_content, patch_parsers, toggle=True
            )

        issue_tables.append(issue_table)

    comment_body = installation.format_open_pr_comment(issue_tables)

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

    try:
        installation.create_or_update_comment(
            repo=repo,
            pr_key=pr.key,
            comment_data={"body": comment_body},
            pullrequest_id=pr.id,
            issue_ids=issue_id_list,
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
            OPEN_PR_METRICS_BASE.format(integration="github", key="error"),
            tags={"type": "api_error"},
        )
        raise

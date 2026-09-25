from __future__ import annotations

from typing import TypedDict
from urllib.parse import urlencode

import orjson
from django.template.defaultfilters import pluralize
from sentry_relay.processing import parse_release

from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.deploy import Deploy
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.repository import Repository
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.utils import format_datetime
from sentry.notifications.platform.types import (
    BoldTextBlock,
    CodeTextBlock,
    ItalicTextBlock,
    LinkTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSource,
    NotificationTemplate,
    NotificationTextBlock,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.users.services.user.service import user_service

TEXT_DELIMITER = " · "
MAX_SUBJECT_PROJECTS = 2
# Slack enforces a hard limit of 50 blocks per chat.postMessage call.
SLACK_MAX_BLOCKS = 50


class DeployReleaseCommit(TypedDict):
    author_name: str
    date: str  # ISO string
    sha: str
    message: str


class DeployReleaseProject(TypedDict):
    resolved_issue_count: int
    release_url: str
    project_slug: str


class DeployReleaseData(NotificationData):
    source: NotificationSource = NotificationSource.DEPLOY_RELEASE
    # If this notification was triggered by an alert (Workflow)...
    alert_name: str | None = None
    alert_url: str | None = None
    # If the target recipient is a user, this link will direct them to their notification preferences.
    user_settings_url: str | None = None
    date: str  # ISO string
    author_count: int
    commit_count: int
    file_count: int
    release_projects: list[DeployReleaseProject]
    repo_name_to_commits: dict[str, list[DeployReleaseCommit]]
    repo_setup_link: str | None = None
    version: str = "unknown"
    environment_name: str = "default"


def build_deploy_subject(data: DeployReleaseData) -> list[NotificationTextBlock]:
    readable_version = parse_release(data.version, json_loads=orjson.loads)["description"]
    project_slugs = [rp["project_slug"] for rp in data.release_projects]
    visible_project_slugs = list(project_slugs[:MAX_SUBJECT_PROJECTS])
    remaining_projects = len(project_slugs) - len(visible_project_slugs)
    projects_text = ", ".join(visible_project_slugs)
    if remaining_projects > 0:
        projects_text = f"{projects_text} (+{remaining_projects} more)"
    if not projects_text:
        projects_text = "a project"
    return [
        PlainTextBlock(text="Deployed"),
        CodeTextBlock(text=readable_version),
        PlainTextBlock(text=f"of {projects_text} to {data.environment_name}"),
    ]


def build_deploy_body(data: DeployReleaseData) -> list[NotificationSection]:
    readable_version = parse_release(data.version, json_loads=orjson.loads)["description"]
    summary_sections: list[NotificationSection] = [
        ParagraphSection(
            blocks=[
                PlainTextBlock(text="Release"),
                CodeTextBlock(text=readable_version),
                PlainTextBlock(
                    text=f"has been deployed to the {data.environment_name} environment."
                ),
            ]
        ),
        ParagraphSection(
            blocks=[
                PlainTextBlock(text=format_datetime(data.date)),
                PlainTextBlock(text=TEXT_DELIMITER),
                PlainTextBlock(text=f"{data.commit_count} commit{pluralize(data.commit_count)},"),
                PlainTextBlock(
                    text=f"{data.author_count} author{pluralize(data.author_count)}, and"
                ),
                PlainTextBlock(
                    text=f"{data.file_count} file{pluralize(data.file_count)} changed across"
                ),
                PlainTextBlock(
                    text=f"{len(data.release_projects)} project{pluralize(len(data.release_projects))}"
                ),
            ]
        ),
    ]
    project_sections: list[NotificationSection] = []
    if data.release_projects:
        project_sections.append(ParagraphSection(blocks=[BoldTextBlock(text="Projects:")]))
        for rp in data.release_projects:
            release_project_blocks = [
                PlainTextBlock(text=f"{rp['project_slug']} ("),
                LinkTextBlock(text="View Release", url=rp["release_url"]),
                PlainTextBlock(text=")"),
            ]
            if rp["resolved_issue_count"]:
                release_project_blocks.append(
                    PlainTextBlock(
                        text=f"resolving {rp['resolved_issue_count']} issue{pluralize(rp['resolved_issue_count'])}."
                    )
                )
            project_sections.append(ParagraphSection(blocks=release_project_blocks))

    # Compute how many Slack blocks SlackRenderer will add outside the body:
    #   - 1 HeaderBlock for the subject (always)
    #   - 1 ContextBlock for the footer (when non-empty)
    #   - 1 ActionsBlock for actions (when non-empty)
    slack_overhead = (
        1  # subject HeaderBlock — always present
        + int(bool(build_deploy_footer(data)))
        + int(bool(build_deploy_actions(data)))
    )
    max_body_blocks = SLACK_MAX_BLOCKS - slack_overhead

    # Defensive check: ensure projects don't exceed the available budget
    # Reserve space for commits section: 2 blocks when there are commits (header + at least one),
    # or 1 block when there are no commits (just the placeholder message)
    commits_section_reserve = 2 if data.repo_name_to_commits else 1
    max_project_blocks = max_body_blocks - len(summary_sections) - commits_section_reserve
    if len(project_sections) > max_project_blocks and max_project_blocks > 1:
        # Keep the "Projects:" header (first section) and truncate the rest
        # Reserve 1 slot for the truncation notice itself
        original_count = len(project_sections)
        truncated_count = original_count - (max_project_blocks - 1)
        project_sections = project_sections[: max_project_blocks - 1]
        project_sections.append(
            ParagraphSection(
                blocks=[
                    ItalicTextBlock(
                        text=f"{truncated_count} more project{pluralize(truncated_count)} not shown."
                    )
                ]
            )
        )

    commits_sections: list[NotificationSection] = []
    if data.repo_name_to_commits:
        # How many slots are available for the entire commits_sections list, after reserving
        # space for summary and project sections. Use max() to prevent negative budgets.
        commits_budget = max(1, max_body_blocks - len(summary_sections) - len(project_sections))

        total_commits = sum(len(c) for c in data.repo_name_to_commits.values())
        shown_commits = 0
        truncated = False

        # Only open the "Repositories:" section when there is budget for the header AND at
        # least one more entry.  With budget == 1 we skip the header and use that single
        # remaining slot for the truncation notice below.
        if commits_budget >= 2:
            commits_sections.append(ParagraphSection(blocks=[BoldTextBlock(text="Repositories:")]))
            for repo_name, commits in data.repo_name_to_commits.items():
                if truncated:
                    break
                # Reserve 1 slot for a potential truncation notice before adding the repo header.
                if len(commits_sections) >= commits_budget - 1:
                    truncated = True
                    break
                commits_sections.append(ParagraphSection(blocks=[BoldTextBlock(text=repo_name)]))
                for commit in commits:
                    # Reserve 1 slot for a potential truncation notice before adding each commit.
                    if len(commits_sections) >= commits_budget - 1:
                        truncated = True
                        break
                    commit_blocks = [
                        PlainTextBlock(commit["message"]),
                        PlainTextBlock(text=TEXT_DELIMITER),
                        ItalicTextBlock(text=commit["author_name"]),
                        PlainTextBlock(text=TEXT_DELIMITER),
                        ItalicTextBlock(text=format_datetime(commit["date"])),
                        PlainTextBlock(text=TEXT_DELIMITER),
                        CodeTextBlock(text=commit["sha"]),
                    ]
                    commits_sections.append(ParagraphSection(blocks=commit_blocks))
                    shown_commits += 1
        elif commits_budget == 1:
            # Only 1 slot available — skip the header and use it for the truncation notice.
            truncated = True

        if truncated and len(commits_sections) < commits_budget:
            omitted = total_commits - shown_commits
            commits_sections.append(
                ParagraphSection(
                    blocks=[
                        ItalicTextBlock(
                            text=f"{omitted} more commit{pluralize(omitted)} not shown."
                        )
                    ]
                )
            )
    else:
        commits_sections.append(
            ParagraphSection(
                blocks=[
                    ItalicTextBlock(
                        text="Deploys are better with commit data. Connecting repositories to Sentry will show a list of deploy commits in this message."
                    )
                ]
            )
        )

    body = [
        *summary_sections,
        *project_sections,
        *commits_sections,
    ]
    # Hard cap as a safety net: ensure the total body never exceeds the Slack block limit
    # regardless of how many project or summary sections were generated.
    return body[:max_body_blocks]


def build_deploy_actions(data: DeployReleaseData) -> list[NotificationRenderedAction]:
    if data.repo_name_to_commits or not data.repo_setup_link:
        return []
    return [NotificationRenderedAction(label="Connect a repository", link=data.repo_setup_link)]


def build_deploy_footer(data: DeployReleaseData) -> list[NotificationTextBlock]:
    blocks: list[NotificationTextBlock] = []
    if data.alert_name and data.alert_url:
        blocks.append(PlainTextBlock(text="Alert:"))
        blocks.append(LinkTextBlock(text=data.alert_name, url=data.alert_url))
    if data.user_settings_url and blocks:
        blocks.append(PlainTextBlock(text=TEXT_DELIMITER))
    if data.user_settings_url:
        blocks.append(LinkTextBlock(text="Manage Preferences", url=data.user_settings_url))
    return blocks


@template_registry.register(NotificationSource.DEPLOY_RELEASE)
class DeployReleaseTemplate(NotificationTemplate[DeployReleaseData]):
    category = NotificationCategory.DEPLOY
    example_data = DeployReleaseData(
        source=NotificationSource.DEPLOY_RELEASE,
        user_settings_url="https://sentry.io/settings/account/notifications/deploy/",
        alert_name="Notify #feed-deploys via Slack",
        alert_url="https://sentry.io/organizations/acme/monitors/alerts/1/",
        author_count=3,
        commit_count=4,
        file_count=12,
        environment_name="production",
        repo_setup_link="https://sentry.io/organizations/acme/repos/",
        version="v1.0.0",
        date="2026-02-01T06:00:40+00:00",
        release_projects=[
            {
                "resolved_issue_count": 2,
                "release_url": "https://sentry.io/organizations/acme/releases/v1.0.0/?project=1",
                "project_slug": "backend",
            },
            {
                "resolved_issue_count": 4,
                "release_url": "https://sentry.io/organizations/acme/releases/v1.0.0/?project=1",
                "project_slug": "frontend",
            },
        ],
        repo_name_to_commits={
            "getsentry/sentry": [
                {
                    "author_name": "alice",
                    "date": "2026-01-01T06:00:40+00:00",
                    "sha": "a1b2c3d",
                    "message": "fix(auth): correct oauth redirect url",
                },
                {
                    "author_name": "bob",
                    "date": "2026-01-02T07:00:40+00:00",
                    "sha": "a4b5c6d",
                    "message": "chore(platform): sort modules alphabetically",
                },
                {
                    "author_name": "charlie",
                    "date": "2026-01-03T08:00:40+00:00",
                    "sha": "a7b8c9d",
                    "message": "tests(infra): skip a few flaky tests",
                },
            ],
            "getsentry/getsentry": [
                {
                    "author_name": "alice",
                    "date": "2026-01-04T09:00:40+00:00",
                    "sha": "d1e2f30",
                    "message": "fix(platform): undo bob's sorting",
                }
            ],
        },
    )

    def render(self, data: DeployReleaseData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=build_deploy_subject(data=data),
            body=build_deploy_body(data=data),
            actions=build_deploy_actions(data=data),
            footer=build_deploy_footer(data=data),
        )


class DeployReleaseDataResult(TypedDict):
    data: DeployReleaseData
    # These are attached here because they're also used in the strategy, saving duplicate queries
    committer_user_ids: set[int]
    projects: set[Project]


def build_deploy_release_data(deploy: Deploy, release: Release) -> DeployReleaseDataResult:
    from sentry.notifications.utils import get_environment_for_deploy, get_group_counts_by_project

    organization = release.organization
    projects = set(release.projects.all())
    commit_list = list(Commit.objects.get_for_release(release))
    email_list = {c.author.email for c in commit_list if c.author}
    users = user_service.get_many_by_email(
        emails=list(email_list),
        organization_id=organization.id,
        is_verified=True,
    )
    users_by_email = {u.email: u for u in users}

    environment = get_environment_for_deploy(deploy)
    group_counts_by_project = get_group_counts_by_project(release, projects)

    release_projects: list[DeployReleaseProject] = []
    for project in sorted(projects, key=lambda p: p.slug):
        release_url = organization.absolute_url(
            f"/organizations/{organization.slug}/releases/{release.version}/",
            query=urlencode({"project": project.id}),
        )
        release_projects.append(
            DeployReleaseProject(
                project_slug=project.slug,
                release_url=release_url,
                resolved_issue_count=group_counts_by_project.get(project.id, 0),
            )
        )

    repo_name_to_commits: dict[str, list[DeployReleaseCommit]] = {}

    repositories_by_id = {
        repo_id: repo_name
        for repo_id, repo_name in Repository.objects.filter(
            organization_id=organization.id,
            id__in={c.repository_id for c in commit_list},
        ).values_list("id", "name")
    }
    for commit in commit_list:
        repo_name = repositories_by_id.get(commit.repository_id, "unknown")
        author_name = ""
        if commit.author:
            user_option = users_by_email.get(commit.author.email)
            author_name = (
                user_option.get_display_name() if user_option else commit.author.name or ""
            )
        repo_name_to_commits.setdefault(repo_name, []).append(
            DeployReleaseCommit(
                author_name=author_name,
                date=commit.date_added.isoformat() if commit.date_added else "",
                sha=commit.short_id,
                message=commit.title,
            )
        )

    data = DeployReleaseData(
        date=deploy.date_finished.isoformat() if deploy.date_finished else "",
        author_count=len(email_list),
        commit_count=len(commit_list),
        file_count=CommitFileChange.objects.get_count_for_commits(commit_list),
        release_projects=release_projects,
        repo_name_to_commits=repo_name_to_commits,
        repo_setup_link=organization.absolute_url(f"/organizations/{organization.slug}/repos/"),
        version=release.version,
        environment_name=environment,
    )

    return DeployReleaseDataResult(
        data=data,
        committer_user_ids={u.id for u in users},
        projects=projects,
    )


def filter_deploy_data(
    *,
    data: DeployReleaseData,
    organization: Organization,
    user_id: int | None,
) -> DeployReleaseData:
    if user_id is None:
        return data

    user_settings_url = organization.absolute_url("settings/account/notifications/deploy/")
    if organization.flags.allow_joinleave:
        return data.copy(update={"user_settings_url": user_settings_url})

    user_team_ids = OrganizationMember.objects.get_teams_by_user(organization).get(user_id, [])
    user_project_slugs = (
        set(Project.objects.get_for_team_ids(user_team_ids).values_list("slug", flat=True))
        if user_team_ids
        else set()
    )
    filtered_release_projects = [
        rp for rp in data.release_projects if rp["project_slug"] in user_project_slugs
    ]

    return data.copy(
        update={
            "release_projects": filtered_release_projects,
            "user_settings_url": user_settings_url,
        }
    )

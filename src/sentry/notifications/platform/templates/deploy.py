from typing import TypedDict

import orjson
from django.template.defaultfilters import pluralize
from sentry_relay.processing import parse_release

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

TEXT_DELIMITER = " · "
MAX_SUBJECT_PROJECTS = 2


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
    notification_uuid: str
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

    commits_sections: list[NotificationSection] = []
    if data.repo_name_to_commits:
        commits_sections.append(ParagraphSection(blocks=[BoldTextBlock(text="Repositories:")]))
        for repo_name, commits in data.repo_name_to_commits.items():
            commits_sections.append(ParagraphSection(blocks=[BoldTextBlock(text=repo_name)]))
            repo_sections: list[NotificationSection] = []
            for commit in commits:
                commit_blocks = [
                    PlainTextBlock(commit["message"]),
                    PlainTextBlock(text=TEXT_DELIMITER),
                    ItalicTextBlock(text=commit["author_name"]),
                    PlainTextBlock(text=TEXT_DELIMITER),
                    ItalicTextBlock(text=format_datetime(commit["date"])),
                    PlainTextBlock(text=TEXT_DELIMITER),
                    CodeTextBlock(text=commit["sha"]),
                ]
                repo_sections.append(ParagraphSection(blocks=commit_blocks))
            commits_sections.extend(repo_sections)
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

    return [
        *summary_sections,
        *project_sections,
        *commits_sections,
    ]


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
        notification_uuid="1234567890",
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

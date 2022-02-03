from __future__ import annotations

from typing import Any, Iterable, Mapping, MutableMapping, Sequence

from sentry_relay import parse_release

from sentry.models import (
    Activity,
    CommitFileChange,
    OrganizationMember,
    Project,
    Team,
    User,
    UserEmail,
)
from sentry.notifications.types import NotificationSettingTypes
from sentry.notifications.utils import (
    get_commits_for_release,
    get_deploy,
    get_environment_for_deploy,
    get_group_counts_by_project,
    get_release,
    get_repos,
)
from sentry.notifications.utils.actions import MessageAction
from sentry.notifications.utils.participants import get_participants_for_release
from sentry.types.integrations import ExternalProviders
from sentry.utils.compat import zip
from sentry.utils.http import absolute_uri

from .base import ActivityNotification


class ReleaseActivityNotification(ActivityNotification):
    referrer_base = "release-activity"
    notification_setting_type = NotificationSettingTypes.DEPLOY

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.group = None
        self.user_id_team_lookup: Mapping[int, list[int]] | None = None
        self.email_list: set[str] = set()
        self.user_ids: set[int] = set()
        self.deploy = get_deploy(activity)
        self.release = get_release(activity, self.organization)

        if not self.release:
            self.repos: Iterable[Mapping[str, Any]] = set()
            self.projects: set[Project] = set()
            self.version = "unknown"
            self.version_parsed = self.version
            return

        self.projects = set(self.release.projects.all())
        self.commit_list = get_commits_for_release(self.release)
        self.email_list = {c.author.email for c in self.commit_list if c.author}
        users = UserEmail.objects.get_users_by_emails(self.email_list, self.organization)
        self.user_ids = {u.id for u in users.values()}
        self.repos = get_repos(self.commit_list, users, self.organization)
        self.environment = get_environment_for_deploy(self.deploy)
        self.group_counts_by_project = get_group_counts_by_project(self.release, self.projects)

        self.version = self.release.version
        self.version_parsed = parse_release(self.version)["description"]

    def should_email(self) -> bool:
        return bool(self.release and self.deploy)

    def get_participants_with_group_subscription_reason(
        self,
    ) -> Mapping[ExternalProviders, Mapping[Team | User, int]]:
        return get_participants_for_release(self.projects, self.organization, self.user_ids)

    def get_users_by_teams(self) -> Mapping[int, list[int]]:
        if not self.user_id_team_lookup:
            lookup: Mapping[int, list[int]] = OrganizationMember.objects.get_teams_by_user(
                self.organization
            )
            self.user_id_team_lookup = lookup
        return self.user_id_team_lookup

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            **self.get_base_context(),
            "author_count": len(self.email_list),
            "commit_count": len(self.commit_list),
            "deploy": self.deploy,
            "environment": self.environment,
            "file_count": CommitFileChange.objects.get_count_for_commits(self.commit_list),
            "release": self.release,
            "repos": self.repos,
            "setup_repo_link": absolute_uri(f"/organizations/{self.organization.slug}/repos/"),
            "text_description": f"Version {self.version_parsed} was deployed to {self.environment}",
            "version_parsed": self.version_parsed,
        }

    def get_projects(self, recipient: Team | User) -> set[Project]:
        if not self.release:
            return set()

        if isinstance(recipient, User):
            if recipient.is_superuser or self.organization.flags.allow_joinleave:
                # Admins can see all projects.
                return self.projects
            team_ids = self.get_users_by_teams()[recipient.id]
        else:
            team_ids = [recipient.id]

        projects: set[Project] = Project.objects.get_for_team_ids(team_ids).filter(
            id__in={p.id for p in self.projects}
        )
        return projects

    def get_recipient_context(
        self, recipient: Team | User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        projects = self.get_projects(recipient)
        release_links = [
            absolute_uri(
                f"/organizations/{self.organization.slug}/releases/{self.version}/?project={p.id}"
            )
            for p in projects
        ]

        resolved_issue_counts = [self.group_counts_by_project.get(p.id, 0) for p in projects]
        return {
            **super().get_recipient_context(recipient, extra_context),
            "projects": zip(projects, release_links, resolved_issue_counts),
            "project_count": len(projects),
        }

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Deployed version {self.version_parsed} to {self.environment}"

    def get_title(self) -> str:
        return self.get_subject()

    def get_notification_title(self) -> str:
        projects_text = ""
        if len(self.projects) == 1:
            projects_text = " for this project"
        elif len(self.projects) > 1:
            projects_text = " for these projects"
        return f"Release {self.version_parsed} was deployed to {self.environment}{projects_text}"

    def get_filename(self) -> str:
        return "activity/release"

    def get_category(self) -> str:
        return "release_activity_email"

    def get_message_actions(self, recipient: Team | User) -> Sequence[MessageAction]:
        if self.release:
            release = get_release(self.activity, self.project.organization)
            if release:
                return [
                    MessageAction(
                        name=project.slug,
                        url=absolute_uri(
                            f"/organizations/{project.organization.slug}/releases/{release.version}/?project={project.id}&unselectedSeries=Healthy/"
                        ),
                    )
                    for project in self.release.projects.all()
                ]
        return []

    def build_attachment_title(self, recipient: Team | User) -> str:
        return ""

    def get_title_link(self, recipient: Team | User) -> str | None:
        return None

    def build_notification_footer(self, recipient: Team | User) -> str:
        # notification footer only used for Slack for now
        settings_url = self.get_settings_url(recipient, ExternalProviders.SLACK)

        # no environment related to a deploy
        if self.release:
            return f"{self.release.projects.all()[0].slug} | <{settings_url}|Notification Settings>"
        return f"<{settings_url}|Notification Settings>"

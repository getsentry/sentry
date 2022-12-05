from __future__ import annotations

from typing import Any, Mapping, MutableMapping, Sequence
from urllib.parse import quote

from django.db.models import Count, Q
from sentry_relay import parse_release

from sentry.integrations.slack.utils.escape import escape_slack_text
from sentry.models import (
    Activity,
    Commit,
    CommitFileChange,
    Environment,
    Group,
    OrganizationMember,
    Project,
    Team,
    User,
)
from sentry.notifications.types import NotificationSettingTypes
from sentry.notifications.utils import get_deploy, get_release
from sentry.notifications.utils.actions import MessageAction
from sentry.notifications.utils.participants import (
    _get_release_committers,
    get_participants_for_release,
)
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

from .base import ActivityNotification


class ReleaseSummaryActivityNotification(ActivityNotification):
    metrics_key = "release_summary"
    notification_setting_type = NotificationSettingTypes.DEPLOY
    template_path = "sentry/emails/activity/release_summary"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.group = None
        self.user_id_team_lookup: Mapping[int, list[int]] | None = None
        self.deploy = get_deploy(activity)
        self.release = get_release(activity, self.organization)

        if not self.release or not self.deploy:
            self.email_list: set[str] = set()
            self.user_ids: set[int] = set()
            self.projects: set[Project] = set()
            self.version = "unknown"
            self.version_parsed = self.version
            return

        self.projects = set(self.release.projects.all())
        self.commit_list = Commit.objects.get_for_release(self.release)
        self.email_list = {c.author.email for c in self.commit_list if c.author}
        # TODO(workflow): Can use the same users from the commit list after active-release-notification-opt-in
        users = _get_release_committers(self.release)
        self.user_ids = {u.id for u in users}
        environment = Environment.objects.filter(id=self.deploy.environment_id).first()
        self.environment = str(environment.name) if environment else "Default Environment"
        group_environment_filter = (
            Q(groupenvironment__environment_id=environment.id) if environment else Q()
        )
        self.group_counts_by_project = dict(
            Group.objects.filter(
                group_environment_filter, project__in=self.projects, first_release=self.release
            )
            .values_list("project")
            .annotate(num_groups=Count("id"))
        )

        self.version = self.release.version
        self.version_parsed = parse_release(self.version)["description"]

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
            "file_count": CommitFileChange.objects.get_count_for_commits(self.commit_list),
            "deploy": self.deploy,
            "environment": self.environment,
            "release": self.release,
            "text_description": f"Release {self.version_parsed} has been deployed to {self.environment} for an hour",
            "version_parsed": self.version_parsed,
        }

    def get_projects(self, recipient: Team | User) -> set[Project]:
        if not self.release:
            return set()

        if recipient.class_name() == "User":
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
                f"/organizations/{self.organization.slug}/releases/{quote(self.version)}/?project={p.id}"
            )
            for p in projects
        ]
        issues_links = [
            absolute_uri(
                f"/organizations/{self.organization.slug}/issues/?project={p.id}&query={quote(f'firstRelease:{self.version}')}&referrer=release_summary"
            )
            for p in projects
        ]

        new_issue_counts = [self.group_counts_by_project.get(p.id, 0) for p in projects]
        return {
            **super().get_recipient_context(recipient, extra_context),
            "projects": list(zip(projects, release_links, issues_links, new_issue_counts)),
            "project_count": len(projects),
        }

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Deployment version {self.version_parsed} to {self.environment} one hour summary"

    @property
    def title(self) -> str:
        return self.get_subject()

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        # TODO(workflow): Pass all projects as query parameters to issues link
        project_query = ""
        if self.release:
            project = self.release.projects.first()
            project_query = f"&project={project.id}"

        release_link = absolute_uri(
            f"/organizations/{self.organization.slug}/releases/{quote(self.version)}/?referrer=release_summary{project_query}"
        )
        issues_link = absolute_uri(
            f"/organizations/{self.organization.slug}/issues/?query={quote(f'firstRelease:{self.version}')}{project_query}&referrer=release_summary"
        )
        new_issue_counts = sum(self.group_counts_by_project.get(p.id, 0) for p in self.projects)
        release_url_text = self.format_url(
            text=escape_slack_text(self.version_parsed), url=release_link, provider=provider
        )
        issue_url_text = self.format_url(
            text=f"{new_issue_counts} issues", url=issues_link, provider=provider
        )
        message = (
            f"Release {release_url_text} has been deployed to {self.environment} for an hour"
            f" with {issue_url_text} associated with it"
        )

        return message

    def get_message_actions(
        self, recipient: Team | User, provider: ExternalProviders
    ) -> Sequence[MessageAction]:
        return []

    def build_attachment_title(self, recipient: Team | User) -> str:
        return ""

    def get_title_link(self, recipient: Team | User, provider: ExternalProviders) -> str | None:
        return None

    def build_notification_footer(self, recipient: Team | User, provider: ExternalProviders) -> str:
        settings_url = self.get_settings_url(recipient, provider)

        # no environment related to a deploy
        footer = ""
        if self.release:
            footer += f"{self.release.projects.all()[0].slug} | "

        footer += (
            f"{self.format_url(text='Notification Settings', url=settings_url, provider=provider)}"
        )

        return footer

    def send(self) -> None:
        # Don't create a message when the Activity doesn't have a release and deploy.
        if bool(self.release and self.deploy):
            return super().send()

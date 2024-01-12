from __future__ import annotations

from typing import Any, Iterable, Mapping, MutableMapping, Sequence
from urllib.parse import urlencode

from sentry_relay.processing import parse_release

from sentry import features
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.notifications.types import NotificationSettingEnum
from sentry.notifications.utils import (
    get_deploy,
    get_environment_for_deploy,
    get_group_counts_by_project,
    get_release,
    get_repos,
)
from sentry.notifications.utils.actions import MessageAction
from sentry.notifications.utils.participants import ParticipantMap, get_participants_for_release
from sentry.services.hybrid_cloud.actor import ActorType, RpcActor
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.integrations import ExternalProviders

from .base import ActivityNotification


class ReleaseActivityNotification(ActivityNotification):
    metrics_key = "release_activity"
    notification_setting_type_enum = NotificationSettingEnum.DEPLOY
    template_path = "sentry/emails/activity/release"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.group = None
        self.user_id_team_lookup: Mapping[int, list[int]] | None = None
        self.deploy = get_deploy(activity)
        self.release = get_release(activity, self.organization)

        if not self.release:
            self.email_list: set[str] = set()
            self.repos: Iterable[Mapping[str, Any]] = set()
            self.projects: set[Project] = set()
            self.version = "unknown"
            self.version_parsed = self.version
            self.user_ids = set()
            return

        self.projects = set(self.release.projects.all())
        self.commit_list = list(Commit.objects.get_for_release(self.release))
        self.email_list = {c.author.email for c in self.commit_list if c.author}
        users = user_service.get_many_by_email(
            emails=list(self.email_list),
            organization_id=self.organization.id,
            is_verified=True,
        )
        self.user_ids = {u.id for u in users}
        self.repos = get_repos(self.commit_list, {u.email: u for u in users}, self.organization)
        self.environment = get_environment_for_deploy(self.deploy)
        self.group_counts_by_project = get_group_counts_by_project(self.release, self.projects)

        self.version = self.release.version
        self.version_parsed = parse_release(self.version)["description"]

    def get_participants_with_group_subscription_reason(self) -> ParticipantMap:
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
            "setup_repo_link": self.organization.absolute_url(
                f"/organizations/{self.organization.slug}/repos/",
                query=urlencode(
                    {"referrer": self.metrics_key, "notification_uuid": self.notification_uuid}
                ),
            ),
            "text_description": f"Version {self.version_parsed} was deployed to {self.environment}",
            "version_parsed": self.version_parsed,
        }

    def get_projects(self, recipient: RpcActor) -> set[Project]:
        if not self.release:
            return set()

        if recipient.actor_type == ActorType.USER:
            if self.organization.flags.allow_joinleave:
                return self.projects
            team_ids = self.get_users_by_teams()[recipient.id]
        else:
            team_ids = [recipient.id]

        projects: set[Project] = Project.objects.get_for_team_ids(team_ids).filter(
            id__in={p.id for p in self.projects}
        )
        return projects

    def get_recipient_context(
        self, recipient: RpcActor, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        projects = self.get_projects(recipient)
        release_links = [
            self.organization.absolute_url(
                f"/organizations/{self.organization.slug}/releases/{self.version}/?project={p.id}",
                query=urlencode(
                    {"referrer": self.metrics_key, "notification_uuid": self.notification_uuid}
                ),
            )
            for p in projects
        ]

        resolved_issue_counts = [self.group_counts_by_project.get(p.id, 0) for p in projects]
        return {
            **super().get_recipient_context(recipient, extra_context),
            "projects": list(zip(projects, release_links, resolved_issue_counts)),
            "project_count": len(projects),
        }

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Deployed version {self.version_parsed} to {self.environment}"

    @property
    def title(self) -> str:
        return self.get_subject()

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        projects_text = ""
        if len(self.projects) == 1:
            projects_text = " for this project"
        elif len(self.projects) > 1:
            projects_text = " for these projects"
        return f"Release {self.version_parsed} was deployed to {self.environment}{projects_text}"

    def get_message_actions(
        self, recipient: RpcActor, provider: ExternalProviders
    ) -> Sequence[MessageAction]:
        if self.release:
            release = get_release(self.activity, self.project.organization)
            if release:
                return [
                    MessageAction(
                        name=project.slug,
                        label=project.slug
                        if features.has("organizations:slack-block-kit", self.project.organization)
                        else None,
                        url=self.organization.absolute_url(
                            f"/organizations/{project.organization.slug}/releases/{release.version}/",
                            query=f"project={project.id}&unselectedSeries=Healthy&referrer={self.metrics_key}&notification_uuid={self.notification_uuid}",
                        ),
                    )
                    for project in self.release.projects.all()
                ]
        return []

    def build_attachment_title(self, recipient: RpcActor) -> str:
        return ""

    def get_title_link(self, recipient: RpcActor, provider: ExternalProviders) -> str | None:
        return None

    def build_notification_footer(self, recipient: RpcActor, provider: ExternalProviders) -> str:
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

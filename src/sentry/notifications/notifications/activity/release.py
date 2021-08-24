from typing import Any, Iterable, List, Mapping, MutableMapping, Optional, Set

from sentry.models import Activity, CommitFileChange, Project, User
from sentry.notifications.utils import (
    get_commits_for_release,
    get_deploy,
    get_environment_for_deploy,
    get_group_counts_by_project,
    get_projects,
    get_release,
    get_repos,
    get_users_by_emails,
    get_users_by_teams,
)
from sentry.notifications.utils.participants import get_participants_for_release
from sentry.types.integrations import ExternalProviders
from sentry.utils.compat import zip
from sentry.utils.http import absolute_uri

from .base import ActivityNotification


class ReleaseActivityNotification(ActivityNotification):
    fine_tuning_key = "deploy"

    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.group = None
        self.organization = self.project.organization
        self.user_id_team_lookup: Optional[Mapping[int, List[int]]] = None
        self.email_list: Set[str] = set()
        self.user_ids: Set[int] = set()
        self.deploy = get_deploy(activity)
        self.release = get_release(activity, self.organization)

        if not self.release:
            self.repos: Iterable[Mapping[str, Any]] = set()
            self.projects: Set[Project] = set()
            self.version = "unknown"
            return

        self.projects = set(self.release.projects.all())
        self.commit_list = get_commits_for_release(self.release)
        self.email_list = {c.author.email for c in self.commit_list if c.author}
        users = get_users_by_emails(self.email_list, self.organization)
        self.user_ids = {u.id for u in users.values()}
        self.repos = get_repos(self.commit_list, users, self.organization)
        self.environment = get_environment_for_deploy(self.deploy)
        self.group_counts_by_project = get_group_counts_by_project(self.release, self.projects)
        self.version = self.release.version

    def should_email(self) -> bool:
        return bool(self.release and self.deploy)

    def get_participants_with_group_subscription_reason(
        self,
    ) -> Mapping[ExternalProviders, Mapping[User, int]]:
        return get_participants_for_release(self.projects, self.organization, self.user_ids)

    def get_users_by_teams(self) -> Mapping[int, List[int]]:
        if not self.user_id_team_lookup:
            self.user_id_team_lookup = get_users_by_teams(self.organization)
        return self.user_id_team_lookup

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            **self.get_base_context(),
            "commit_count": len(self.commit_list),
            "author_count": len(self.email_list),
            "file_count": CommitFileChange.objects.get_count_for_commits(self.commit_list),
            "repos": self.repos,
            "release": self.release,
            "deploy": self.deploy,
            "environment": self.environment,
            "setup_repo_link": absolute_uri(f"/organizations/{self.organization.slug}/repos/"),
            "text_description": f"Version {self.version} was deployed to {self.environment}",
        }

    def get_projects(self, user: User) -> Set[Project]:
        if user.is_superuser or self.organization.flags.allow_joinleave:
            return self.projects
        team_ids = self.get_users_by_teams()[user.id]
        return get_projects(self.projects, team_ids)

    def get_user_context(
        self, user: User, extra_context: Mapping[str, Any]
    ) -> MutableMapping[str, Any]:
        projects = self.get_projects(user)
        release_links = [
            absolute_uri(
                f"/organizations/{self.organization.slug}/releases/{self.version}/?project={p.id}"
            )
            for p in projects
        ]

        resolved_issue_counts = [self.group_counts_by_project.get(p.id, 0) for p in projects]
        return {
            **super().get_user_context(user, extra_context),
            "projects": zip(projects, release_links, resolved_issue_counts),
            "project_count": len(projects),
        }

    def get_subject(self, context: Optional[Mapping[str, Any]] = None) -> str:
        return f"Deployed version {self.version} to {self.environment}"

    def get_title(self) -> str:
        return self.get_subject()

    def get_notification_title(self) -> str:
        text = "this project"
        if len(self.projects) > 1:
            text = "these projects"
        return f"Release {self.version[:12]} was deployed to {self.environment} for {text}"

    def get_filename(self) -> str:
        return "activity/release"

    def get_category(self) -> str:
        return "release_activity_email"

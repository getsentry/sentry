from collections import defaultdict
from typing import Any, List, Mapping, MutableMapping, Optional, Set

from django.db.models import Count

from sentry.db.models.query import in_iexact
from sentry.models import (
    Activity,
    CommitFileChange,
    Deploy,
    Environment,
    Group,
    GroupLink,
    NotificationSetting,
    ProjectTeam,
    Release,
    ReleaseCommit,
    Repository,
    User,
    UserEmail,
)
from sentry.notifications.helpers import (
    get_deploy_values_by_provider,
    transform_to_notification_settings_by_user,
)
from sentry.notifications.types import (
    GroupSubscriptionReason,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.types.integrations import ExternalProviders
from sentry.utils.compat import zip
from sentry.utils.http import absolute_uri

from .base import ActivityNotification, notification_providers


class ReleaseActivityNotification(ActivityNotification):
    def __init__(self, activity: Activity) -> None:
        super().__init__(activity)
        self.organization = self.project.organization
        self.user_id_team_lookup: Optional[MutableMapping[int, List[int]]] = None
        self.email_list: Set[str] = set()
        self.user_ids: Set[int] = set()

        try:
            self.deploy = Deploy.objects.get(id=activity.data["deploy_id"])
        except Deploy.DoesNotExist:
            self.deploy = None

        try:
            self.release = Release.objects.get(
                organization_id=self.project.organization_id, version=activity.data["version"]
            )
        except Release.DoesNotExist:
            self.release = None
            self.repos = []
            self.projects = []
        else:
            self.projects = list(self.release.projects.all())
            self.commit_list = [
                rc.commit
                for rc in ReleaseCommit.objects.filter(release=self.release).select_related(
                    "commit", "commit__author"
                )
            ]
            repos = {
                r_id: {"name": r_name, "commits": []}
                for r_id, r_name in Repository.objects.filter(
                    organization_id=self.project.organization_id,
                    id__in={c.repository_id for c in self.commit_list},
                ).values_list("id", "name")
            }

            self.email_list = {c.author.email for c in self.commit_list if c.author}
            if self.email_list:
                users = {
                    ue.email: ue.user
                    for ue in UserEmail.objects.filter(
                        in_iexact("email", self.email_list),
                        is_verified=True,
                        user__sentry_orgmember_set__organization=self.organization,
                    ).select_related("user")
                }
                self.user_ids = {u.id for u in users.values()}

            else:
                users = {}

            for commit in self.commit_list:
                repos[commit.repository_id]["commits"].append(
                    (commit, users.get(commit.author.email) if commit.author_id else None)
                )

            self.repos = list(repos.values())

            self.environment = (
                Environment.objects.get(id=self.deploy.environment_id).name or "Default Environment"
            )

            self.group_counts_by_project = dict(
                Group.objects.filter(
                    project__in=self.projects,
                    id__in=GroupLink.objects.filter(
                        linked_type=GroupLink.LinkedType.commit,
                        linked_id__in=ReleaseCommit.objects.filter(
                            release=self.release
                        ).values_list("commit_id", flat=True),
                    ).values_list("group_id", flat=True),
                )
                .values_list("project")
                .annotate(num_groups=Count("id"))
            )

    def should_email(self) -> bool:
        return bool(self.release and self.deploy)

    def get_reason(self, user: User, value: NotificationSettingOptionValues) -> Optional[int]:
        # Members who opt into all deploy emails.
        if value == NotificationSettingOptionValues.ALWAYS:
            return GroupSubscriptionReason.deploy_setting

        # Members which have been seen in the commit log.
        elif value == NotificationSettingOptionValues.COMMITTED_ONLY and user.id in self.user_ids:
            return GroupSubscriptionReason.committed
        return None

    def get_participants(self) -> Mapping[ExternalProviders, Mapping[User, int]]:
        # Collect all users with verified emails on a team in the related projects.
        users = list(User.objects.get_team_members_with_verified_email_for_projects(self.projects))

        # Get all the involved users' settings for deploy-emails (including
        # users' organization-independent settings.)
        notification_settings = NotificationSetting.objects.get_for_users_by_parent(
            NotificationSettingTypes.DEPLOY,
            users=users,
            parent=self.organization,
        )
        notification_settings_by_user = transform_to_notification_settings_by_user(
            notification_settings, users
        )

        # Map users to their setting value. Prioritize user/org specific, then
        # user default, then product default.
        users_to_reasons_by_provider: MutableMapping[
            ExternalProviders, MutableMapping[User, int]
        ] = defaultdict(dict)
        for user in users:
            notification_settings_by_scope = notification_settings_by_user.get(user, {})
            values_by_provider = get_deploy_values_by_provider(
                notification_settings_by_scope, notification_providers()
            )
            for provider, value in values_by_provider.items():
                reason_option = self.get_reason(user, value)
                if reason_option:
                    users_to_reasons_by_provider[provider][user] = reason_option
        return users_to_reasons_by_provider

    def get_users_by_teams(self) -> Mapping[int, List[int]]:
        if not self.user_id_team_lookup:
            user_teams: MutableMapping[int, List[int]] = defaultdict(list)
            queryset = User.objects.filter(
                sentry_orgmember_set__organization_id=self.organization.id
            ).values_list("id", "sentry_orgmember_set__teams")
            for user_id, team_id in queryset:
                user_teams[user_id].append(team_id)
            self.user_id_team_lookup = user_teams
        return self.user_id_team_lookup

    def get_context(self) -> MutableMapping[str, Any]:
        file_count = (
            CommitFileChange.objects.filter(
                commit__in=self.commit_list, organization_id=self.organization.id
            )
            .values("filename")
            .distinct()
            .count()
        )

        return {
            "commit_count": len(self.commit_list),
            "author_count": len(self.email_list),
            "file_count": file_count,
            "repos": self.repos,
            "release": self.release,
            "deploy": self.deploy,
            "environment": self.environment,
            "setup_repo_link": absolute_uri(f"/organizations/{self.organization.slug}/repos/"),
        }

    def get_user_context(self, user: User) -> MutableMapping[str, Any]:
        if user.is_superuser or self.organization.flags.allow_joinleave:
            projects = self.projects
        else:
            teams = self.get_users_by_teams()[user.id]
            team_projects = set(
                ProjectTeam.objects.filter(team_id__in=teams)
                .values_list("project_id", flat=True)
                .distinct()
            )
            projects = [p for p in self.projects if p.id in team_projects]

        release_links = [
            absolute_uri(
                f"/organizations/{self.organization.slug}/releases/{self.release.version}/?project={p.id}"
            )
            for p in projects
        ]

        resolved_issue_counts = [self.group_counts_by_project.get(p.id, 0) for p in projects]
        return {
            "projects": zip(projects, release_links, resolved_issue_counts),
            "project_count": len(projects),
        }

    def get_subject(self) -> str:
        return f"Deployed version {self.release.version} to {self.environment}"

    def get_template(self) -> str:
        return "sentry/emails/activity/release.txt"

    def get_html_template(self) -> str:
        return "sentry/emails/activity/release.html"

    def get_category(self) -> str:
        return "release_activity_email"

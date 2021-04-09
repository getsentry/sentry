from collections import defaultdict
from itertools import chain

from django.db.models import Count

from sentry.db.models.query import in_iexact
from sentry.models import (
    CommitFileChange,
    Deploy,
    Environment,
    Group,
    GroupLink,
    GroupSubscriptionReason,
    NotificationSetting,
    ProjectTeam,
    Release,
    ReleaseCommit,
    Repository,
    Team,
    User,
    UserEmail,
)
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.utils.compat import zip
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


class ReleaseActivityEmail(ActivityEmail):
    def __init__(self, activity):
        super().__init__(activity)
        self.organization = self.project.organization
        self.user_id_team_lookup = None
        self.email_list = {}
        self.user_ids = {}

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

    def should_email(self):
        return bool(self.release and self.deploy)

    def get_participants(self):
        # collect all users with verified emails on a team in the related projects,
        users = list(
            User.objects.filter(
                emails__is_verified=True,
                sentry_orgmember_set__teams__in=Team.objects.filter(
                    id__in=ProjectTeam.objects.filter(project__in=self.projects).values_list(
                        "team_id", flat=True
                    )
                ),
                is_active=True,
            ).distinct()
        )

        # get all the involved users' settings for deploy-emails (user default
        # saved without org set)
        notification_settings = NotificationSetting.objects.get_for_users_by_parent(
            NotificationSettingTypes.DEPLOY,
            users=users,
            parent=self.organization,
        )

        actor_mapping = {user.actor: user for user in users}

        options_by_user_id = defaultdict(dict)
        for notification_setting in notification_settings:
            key = (
                "default"
                if notification_setting.scope_type == NotificationScopeType.USER.value
                else "org"
            )
            user_option = actor_mapping.get(notification_setting.target)
            if user_option:
                options_by_user_id[user_option.id][key] = notification_setting.value

        # and couple them with the the users' setting value for deploy-emails
        # prioritize user/org specific, then user default, then product default
        users_with_options = {}
        for user in users:
            options = options_by_user_id.get(user.id, {})
            users_with_options[user] = (
                options.get("org")  # org-specific
                or options.get("default")  # user default
                or NotificationSettingOptionValues.COMMITTED_ONLY.value  # product default
            )

        # filter down to members which have been seen in the commit log:
        participants_committed = {
            user: GroupSubscriptionReason.committed
            for user, option in users_with_options.items()
            if (
                option == NotificationSettingOptionValues.COMMITTED_ONLY.value
                and user.id in self.user_ids
            )
        }

        # or who opt into all deploy emails:
        participants_opted = {
            user: GroupSubscriptionReason.deploy_setting
            for user, option in users_with_options.items()
            if option == NotificationSettingOptionValues.ALWAYS.value
        }

        # merge the two type of participants
        return dict(chain(participants_committed.items(), participants_opted.items()))

    def get_users_by_teams(self):
        if not self.user_id_team_lookup:
            user_teams = defaultdict(list)
            queryset = User.objects.filter(
                sentry_orgmember_set__organization_id=self.organization.id
            ).values_list("id", "sentry_orgmember_set__teams")
            for user_id, team_id in queryset:
                user_teams[user_id].append(team_id)
            self.user_id_team_lookup = user_teams
        return self.user_id_team_lookup

    def get_context(self):
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

    def get_user_context(self, user):
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

    def get_subject(self):
        return f"Deployed version {self.release.version} to {self.environment}"

    def get_template(self):
        return "sentry/emails/activity/release.txt"

    def get_html_template(self):
        return "sentry/emails/activity/release.html"

    def get_category(self):
        return "release_activity_email"

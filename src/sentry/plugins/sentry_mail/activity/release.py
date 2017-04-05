from __future__ import absolute_import

from collections import defaultdict

from django.db.models import Count

from sentry.db.models.query import in_iexact
from sentry.models import (
    CommitFileChange, Deploy, Environment, Group,
    GroupSubscriptionReason, GroupCommitResolution,
    Release, ReleaseCommit, Repository, Team, User, UserEmail
)
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


class ReleaseActivityEmail(ActivityEmail):
    def __init__(self, activity):
        super(ReleaseActivityEmail, self).__init__(activity)
        self.organization = self.project.organization
        self.user_id_team_lookup = None

        try:
            self.deploy = Deploy.objects.get(id=activity.data['deploy_id'])
        except Deploy.DoesNotExist:
            self.deploy = None

        try:
            self.release = Release.objects.get(
                organization_id=self.project.organization_id,
                version=activity.data['version'],
            )
        except Release.DoesNotExist:
            self.release = None
            self.repos = []
            self.projects = []
        else:
            self.projects = list(self.release.projects.all())
            self.commit_list = [
                rc.commit
                for rc in ReleaseCommit.objects.filter(
                    release=self.release,
                ).select_related('commit', 'commit__author')
            ]
            repos = {
                r['id']: {
                    'name': r['name'],
                    'commits': [],
                }
                for r in Repository.objects.filter(
                    organization_id=self.project.organization_id,
                    id__in={c.repository_id for c in self.commit_list}
                ).values('id', 'name')
            }

            self.email_list = set([
                c.author.email for c in self.commit_list
                if c.author
            ])
            if self.email_list:
                users = {
                    ue.email: ue.user
                    for ue in UserEmail.objects.filter(
                        in_iexact('email', self.email_list),
                        is_verified=True,
                        user__sentry_orgmember_set__organization=self.organization,
                    ).select_related('user')
                }
            else:
                users = {}

            for commit in self.commit_list:
                repos[commit.repository_id]['commits'].append(
                    (commit, users.get(commit.author.email))
                )

            self.repos = repos.values()

            self.environment = Environment.objects.get(
                id=self.deploy.environment_id
            ).name or 'Default Environment'

            self.group_counts_by_project = {
                row['project']: row['num_groups']
                for row in Group.objects.filter(
                    project__in=self.projects,
                    id__in=GroupCommitResolution.objects.filter(
                        commit_id__in=ReleaseCommit.objects.filter(
                            release=self.release,
                        ).values_list('commit_id', flat=True),
                    ).values_list('group_id', flat=True),
                ).values('project').annotate(num_groups=Count('id'))
            }

    def should_email(self):
        return bool(self.release and self.deploy)

    def get_participants(self):
        if not self.email_list:
            return {}

        # identify members which have been seen in the commit log and have
        # verified the matching email address
        return {
            user: GroupSubscriptionReason.committed
            for user in User.objects.filter(
                in_iexact('emails__email', self.email_list),
                emails__is_verified=True,
                sentry_orgmember_set__teams=Team.objects.filter(
                    id__in=[p.team_id for p in self.projects]
                ),
                is_active=True,
            ).distinct()
        }

    def get_users_by_teams(self):
        if not self.user_id_team_lookup:
            user_teams = defaultdict(list)
            queryset = User.objects.filter(
                sentry_orgmember_set__organization_id=self.organization.id
            ).values('id', 'sentry_orgmember_set__teams')
            for user_team in queryset:
                user_teams[user_team['id']].append(user_team['sentry_orgmember_set__teams'])
            self.user_id_team_lookup = user_teams
        return self.user_id_team_lookup

    def get_context(self):
        file_count = CommitFileChange.objects.filter(
            commit__in=self.commit_list,
            organization_id=self.organization.id,
        ).values('filename').distinct().count()

        return {
            'commit_count': len(self.commit_list),
            'author_count': len(self.email_list),
            'file_count': file_count,
            'repos': self.repos,
            'release': self.release,
            'deploy': self.deploy,
            'environment': self.environment,
            'setup_repo_link': absolute_uri('/organizations/{}/repos/'.format(
                self.organization.slug,
            )),
        }

    def get_user_context(self, user):
        if user.is_superuser or self.organization.flags.allow_joinleave:
            projects = self.projects
        else:
            teams = self.get_users_by_teams()[user.id]
            projects = [p for p in self.projects if p.team_id in teams]
        release_links = [
            absolute_uri('/{}/{}/releases/{}/'.format(
                self.organization.slug,
                p.slug,
                self.release.version,
            )) for p in projects
        ]
        resolved_issue_counts = [
            self.group_counts_by_project.get(p.id, 0) for p in projects
        ]
        return {
            'projects': zip(projects, release_links, resolved_issue_counts),
            'project_count': len(projects),
        }

    def get_subject(self):
        return u'Deployed version {} to {}'.format(
            self.release.short_version,
            self.environment,
        )

    def get_template(self):
        return 'sentry/emails/activity/release.txt'

    def get_html_template(self):
        return 'sentry/emails/activity/release.html'

from __future__ import absolute_import

from sentry import features
from sentry.db.models.query import in_iexact
from sentry.models import (
    CommitFileChange, Deploy, Environment, Group,
    GroupSubscriptionReason, GroupCommitResolution,
    Release, ReleaseCommit, Repository, User
)
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


class ReleaseActivityEmail(ActivityEmail):
    def __init__(self, activity):
        super(ReleaseActivityEmail, self).__init__(activity)
        self.organization = self.project.organization

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
        else:
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
            for commit in self.commit_list:
                repos[commit.repository_id]['commits'].append(commit)

            self.repos = repos.values()

            self.email_list = set([
                c.author.email for c in self.commit_list
                if c.author
            ])
            self.environment = Environment.objects.get(
                id=self.deploy.environment_id
            ).name or 'Default Environment'

    def should_email(self):
        return bool(self.release and self.deploy)

    def get_participants(self):
        project = self.project

        if not self.email_list:
            return {}

        # identify members which have been seen in the commit log and have
        # verified the matching email address
        return {
            user: GroupSubscriptionReason.committed
            for user in User.objects.filter(
                in_iexact('emails__email', self.email_list),
                emails__is_verified=True,
                sentry_orgmember_set__teams=project.team,
                is_active=True,
            ).distinct()
            if features.has('workflow:release-emails', project=self.project, actor=user)
        }

    def get_context(self):
        # TODO(jess): this needs to be filtered by what users have access to
        projects = list(self.release.projects.all())
        file_count = CommitFileChange.objects.filter(
            commit__in=self.commit_list,
            organization_id=self.organization.id,
        ).values('filename').distinct().count()
        release_links = [
            absolute_uri('/{}/{}/releases/{}/'.format(
                self.organization.slug,
                p.slug,
                self.release.version,
            )) for p in projects
        ]
        resolved_issue_counts = [
            Group.objects.filter(
                project=p,
                id__in=GroupCommitResolution.objects.filter(
                    commit_id__in=ReleaseCommit.objects.filter(
                        release=self.release,
                    ).values_list('commit_id', flat=True),
                ).values_list('group_id', flat=True),
            ).count() for p in projects
        ]

        return {
            'projects': zip(projects, release_links, resolved_issue_counts),
            'project_count': len(projects),
            'commit_count': len(self.commit_list),
            'author_count': len(self.email_list),
            'file_count': file_count,
            'repos': self.repos,
            'release': self.release,
            'deploy': self.deploy,
            'environment': self.environment,
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

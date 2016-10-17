from __future__ import absolute_import

from sentry import features
from sentry.db.models.query import in_iexact
from sentry.models import GroupSubscriptionReason, Release, ReleaseCommit, User

from .base import ActivityEmail


class ReleaseActivityEmail(ActivityEmail):
    def __init__(self, activity):
        super(ReleaseActivityEmail, self).__init__(activity)
        try:
            self.release = Release.objects.get(
                project=self.project,
                version=activity.data['version'],
            )
        except Release.DoesNotExist:
            self.release = None
            self.commit_list = []
        else:
            self.commit_list = [
                rc.commit
                for rc in ReleaseCommit.objects.filter(
                    release=self.release,
                ).select_related('commit', 'commit__author')
            ]

    def should_email(self):
        return bool(self.release)

    def get_participants(self):
        project = self.project

        email_list = set([
            c.author.email for c in self.commit_list
            if c.author
        ])

        if not email_list:
            return {}

        # identify members which have been seen in the commit log and have
        # verified the matching email address
        return {
            user: GroupSubscriptionReason.committed
            for user in User.objects.filter(
                in_iexact('emails__email', email_list),
                emails__is_verified=True,
                sentry_orgmember_set__teams=project.team,
                is_active=True,
            ).distinct()
            if features.has('workflow:release-emails', actor=user)
        }

    def get_context(self):
        return {
            'commit_list': self.commit_list,
            'release': self.release,
        }

    def get_subject(self):
        return u'Released {}'.format(self.release.short_version)

    def get_template(self):
        return 'sentry/emails/activity/release.txt'

    def get_html_template(self):
        return 'sentry/emails/activity/release.html'

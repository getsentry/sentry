from __future__ import absolute_import

from sentry.models import User, GroupSubscriptionReason
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


class NewProcessingIssuesActivityEmail(ActivityEmail):

    def __init__(self, activity):
        ActivityEmail.__init__(self, activity)
        self.organization = self.project.organization

    def get_participants(self):
        # XXX: We want to send an email to everybody who is subscribed to
        # the mail alerts.  Since currenlty that is only checked in the
        # base notify code and requires event information, we use the UI
        # code (Project.is_user_subscribed_to_mail_alerts) which
        # replicates the logic on a per-user basis.
        users = User.objects.filter(
            sentry_orgmember_set__teams=self.project.team,
            is_active=True,
        )
        participants = {}
        for user in users:
            if self.project.is_user_subscribed_to_mail_alerts(user):
                participants[user] = GroupSubscriptionReason.processing_issue
        return participants

    def get_context(self):
        return {
            'project': self.project,
            'issues': self.activity.data['issues'],
            'reprocessing_active': self.activity.data['reprocessing_active'],
            'info_url': absolute_uri('/{}/{}/settings/processing-issues/'.format(
                self.organization.slug,
                self.project.slug,
            )),
        }

    def get_subject(self):
        return u'Processing Isuses on {}'.format(
            self.project.name,
        )

    def get_template(self):
        return 'sentry/emails/activity/new_processing_issues.txt'

    def get_html_template(self):
        return 'sentry/emails/activity/new_processing_issues.html'

from __future__ import absolute_import

from sentry.models import User, GroupSubscriptionReason, EventError
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


def summarize_issues(issues):
    rv = []
    for issue in issues:
        extra_info = None
        msg_d = dict(issue['data'])
        msg_d['type'] = issue['type']

        if 'image_path' in issue['data']:
            extra_info = issue['data']['image_path'].rsplit('/', 1)[-1]
            if 'image_arch' in issue['data']:
                extra_info = '%s (%s)' % (
                    extra_info,
                    issue['data']['image_arch'],
                )

        rv.append({
            'message': EventError.get_message(msg_d),
            'extra_info': extra_info,
        })
    return rv


class NewProcessingIssuesActivityEmail(ActivityEmail):

    def __init__(self, activity):
        ActivityEmail.__init__(self, activity)
        self.issues = summarize_issues(self.data['issues'])

    def get_participants(self):
        # XXX: We want to send an email to everybody who is subscribed to
        # the mail alerts.  Since currenlty that is only checked in the
        # base notify code and requires event information, we use the UI
        # code (Project.is_user_subscribed_to_mail_alerts) which
        # replicates the logic on a per-user basis.
        users = User.objects.filter(
            id__in=self.project.team.member_set.values_list('user_id'),
        )
        participants = {}
        for user in users:
            if self.project.is_user_subscribed_to_mail_alerts(user):
                participants[user] = GroupSubscriptionReason.processing_issue
        return participants

    def get_context(self):
        return {
            'project': self.project,
            'issues': self.issues,
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

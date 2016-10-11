from __future__ import absolute_import

from sentry.models import Release, ReleaseCommit

from .base import ActivityEmail


class ReleaseActivityEmail(ActivityEmail):
    def get_context(self):
        return {}

    def get_base_context(self):
        context = super(ReleaseActivityEmail, self).get_base_context()

        try:
            release = Release.objects.get(
                version=self.activity.data['version'],
            )
        except Release.DoesNotExist:
            release = Release(
                version=self.activity.data['version'],
                date_added=self.activity.datetime,
            )
            commit_list = []
        else:
            commit_list = [
                rc.commit
                for rc in ReleaseCommit.objects.filter(
                    release=release,
                ).select_related('commit', 'commit__author')
            ]

        context.update({
            'commit_list': commit_list,
        })
        return context

    def get_template(self):
        return 'sentry/emails/activity/release.txt'

    def get_html_template(self):
        return 'sentry/emails/activity/release.html'

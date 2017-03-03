from __future__ import absolute_import

from sentry.utils.html import escape
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


class ResolvedInReleaseActivityEmail(ActivityEmail):
    def get_activity_name(self):
        return 'Resolved Issue'

    def get_description(self):
        data = self.activity.data
        if data.get('version'):
            return u'{author} marked {an issue} as resolved in {version}', {
                'version': data['version'],
            }, {
                'version': u'<a href="{}">{}</a>'.format(
                    absolute_uri('/{}/{}/releases/{}/'.format(
                        self.organization.slug,
                        self.project.slug,
                        data['version'],
                    )),
                    escape(data['version']),
                )
            }
        return u'{author} marked {an issue} as resolved in an upcoming release'

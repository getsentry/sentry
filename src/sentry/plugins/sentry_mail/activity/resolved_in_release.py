from __future__ import absolute_import

from sentry import features
from sentry.utils.html import escape
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


class ResolvedInReleaseActivityEmail(ActivityEmail):
    def get_activity_name(self):
        return 'Resolved Issue'

    def get_description(self):
        data = self.activity.data

        if features.has('organizations:sentry10', self.organization):
            url = u'/organizations/{}/releases/{}/?project={}'.format(
                self.organization.slug,
                data['version'],
                self.project.id,
            )
        else:
            url = u'/{}/{}/releases/{}/'.format(
                self.organization.slug,
                self.project.slug,
                data['version'],
            )

        if data.get('version'):
            return u'{author} marked {an issue} as resolved in {version}', {
                'version': data['version'],
            }, {
                'version':
                u'<a href="{}">{}</a>'.format(
                    absolute_uri(url),
                    escape(data['version']),
                )
            }
        return u'{author} marked {an issue} as resolved in an upcoming release'

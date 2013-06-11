"""
sentry.plugins.sentry_user_emails.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import sentry

from django.utils.translation import ugettext_lazy as _

from sentry.plugins import register
from sentry.plugins.bases.tag import TagPlugin


class UserEmailsPlugin(TagPlugin):
    """
    Adds additional support for showing information about users including:

    * A panel which shows all users a message was created by.
    * A sidebar module which shows the users most actively seeing event.
    """
    slug = 'user-emails'
    title = _('Auto Tag: User Emails')
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    tag = 'user_email'
    tag_label = _('User Email')

    def get_tag_values(self, event):
        user = event.interfaces.get('sentry.interfaces.User')
        if not user:
            return []
        if not getattr(user, 'email', None):
            return []
        return [user.email]

register(UserEmailsPlugin)

"""
LiveJournal OpenID support.

This contribution adds support for LiveJournal OpenID service in the form
username.livejournal.com. Username is retrieved from the identity url.
"""
import urlparse

from social_auth.backends import OpenIDBackend, OpenIdAuth
from social_auth.exceptions import AuthMissingParameter


# LiveJournal conf
LIVEJOURNAL_URL = 'http://%s.livejournal.com'
LIVEJOURNAL_USER_FIELD = 'openid_lj_user'


class LiveJournalBackend(OpenIDBackend):
    """LiveJournal OpenID authentication backend"""
    name = 'livejournal'

    def get_user_details(self, response):
        """Generate username from identity url"""
        values = super(LiveJournalBackend, self).get_user_details(response)
        values['username'] = values.get('username') or \
                             urlparse.urlsplit(response.identity_url)\
                                   .netloc.split('.', 1)[0]
        return values


class LiveJournalAuth(OpenIdAuth):
    """LiveJournal OpenID authentication"""
    AUTH_BACKEND = LiveJournalBackend

    def uses_redirect(self):
        """LiveJournal uses redirect"""
        return True

    def openid_url(self):
        """Returns LiveJournal authentication URL"""
        if not self.data.get(LIVEJOURNAL_USER_FIELD):
            raise AuthMissingParameter(self, LIVEJOURNAL_USER_FIELD)
        return LIVEJOURNAL_URL % self.data[LIVEJOURNAL_USER_FIELD]


# Backend definition
BACKENDS = {
    'livejournal': LiveJournalAuth,
}

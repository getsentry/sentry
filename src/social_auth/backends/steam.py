"""Steam OpenId support"""
import re
import urllib
import urllib2

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.backends import OpenIdAuth, OpenIDBackend
from social_auth.exceptions import AuthFailed
from social_auth.utils import setting


STEAM_ID = re.compile('steamcommunity.com/openid/id/(.*?)$')
USER_INFO = 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?'


class SteamBackend(OpenIDBackend):
    """Steam OpenId authentication backend"""
    name = 'steam'

    def get_user_id(self, details, response):
        """Return user unique id provided by service"""
        return self._user_id(response)

    def get_user_details(self, response):
        user_id = self._user_id(response)
        url = USER_INFO + urllib.urlencode({'key': setting('STEAM_API_KEY'),
                                            'steamids': user_id})
        details = {}
        try:
            player = simplejson.load(urllib2.urlopen(url))
        except (ValueError, IOError):
            pass
        else:
            if len(player['response']['players']) > 0:
                player = player['response']['players'][0]
                details = {'username': player.get('personaname'),
                           'email': '',
                           'fullname': '',
                           'first_name': '',
                           'last_name': '',
                           'player': player}
        return details

    def extra_data(self, user, uid, response, details):
        return details['player']

    def _user_id(self, response):
        match = STEAM_ID.search(response.identity_url)
        if match is None:
            raise AuthFailed(self, 'Missing Steam Id')
        return match.group(1)


class SteamAuth(OpenIdAuth):
    """Steam OpenId authentication"""
    AUTH_BACKEND = SteamBackend

    def openid_url(self):
        """Return Steam OpenId service url"""
        return 'http://steamcommunity.com/openid'

    @classmethod
    def enabled(cls):
        """Steam OpenId is enabled when STEAM_API_KEY is defined"""
        return setting('STEAM_API_KEY') is not None


# Backend definition
BACKENDS = {
    'steam': SteamAuth
}

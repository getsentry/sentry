from django.utils.translation import get_language
"""
Linkedin OAuth support

No extra configurations are needed to make this work.
"""
from xml.etree import ElementTree
from xml.parsers.expat import ExpatError

from urllib import urlencode
from urllib2 import Request
from oauth2 import Token

try:
    import json as simplejson
except ImportError:
    try:
        import simplejson
    except ImportError:
        from django.utils import simplejson

from social_auth.utils import setting, dsa_urlopen
from social_auth.backends import ConsumerBasedOAuth, OAuthBackend, BaseOAuth2
from social_auth.exceptions import AuthCanceled, AuthUnknownError


LINKEDIN_SERVER = 'linkedin.com'
LINKEDIN_REQUEST_TOKEN_URL = 'https://api.%s/uas/oauth/requestToken' % \
                                    LINKEDIN_SERVER
LINKEDIN_ACCESS_TOKEN_URL = 'https://api.%s/uas/oauth/accessToken' % \
                                    LINKEDIN_SERVER
LINKEDIN_AUTHORIZATION_URL = 'https://www.%s/uas/oauth/authenticate' % \
                                    LINKEDIN_SERVER
LINKEDIN_CHECK_AUTH = 'https://api.%s/v1/people/~' % LINKEDIN_SERVER
# Check doc at http://developer.linkedin.com/docs/DOC-1014 about how to use
# fields selectors to retrieve extra user data
LINKEDIN_FIELD_SELECTORS = ['id', 'first-name', 'last-name']


def add_language_header(request):
    language = setting('LINKEDIN_FORCE_PROFILE_LANGUAGE', False)
    if language is True:
        request.add_header('Accept-Language', get_language())
    elif language:
        request.add_header('Accept-Language', language)


class LinkedinBackend(OAuthBackend):
    """Linkedin OAuth authentication backend"""
    name = 'linkedin'
    EXTRA_DATA = [('id', 'id'),
                  ('first-name', 'first_name'),
                  ('last-name', 'last_name')]

    def get_user_details(self, response):
        """Return user details from Linkedin account"""
        first_name, last_name = response['first-name'], response['last-name']
        email = response.get('email-address', '')
        return {'username': first_name + last_name,
                'fullname': first_name + ' ' + last_name,
                'first_name': first_name,
                'last_name': last_name,
                'email': email}

    @classmethod
    def tokens(cls, instance):
        """ Return list of OAuth v1 tokens from Linkedin  """
        token = super(LinkedinBackend, cls).tokens(instance)
        if token and 'access_token' in token:
            token = dict(tok.split('=')
                            for tok in token['access_token'].split('&'))
        return token


class LinkedinOAuth2Backend(OAuthBackend):
    """Linkedin OAuth2 authentication backend"""
    name = 'linkedin-oauth2'

    EXTRA_DATA = [('id', 'id'),
                  ('firstName', 'first_name'),
                  ('lastName', 'last_name')]

    def get_user_details(self, response):
        first_name, last_name = response['firstName'], response['lastName']
        return {'username': first_name + last_name,
                'fullname': first_name + ' ' + last_name,
                'first_name': first_name,
                'last_name': last_name,
                'email': response.get('emailAddress', '')}


class LinkedinAuth(ConsumerBasedOAuth):
    """Linkedin OAuth authentication mechanism"""
    AUTHORIZATION_URL = LINKEDIN_AUTHORIZATION_URL
    REQUEST_TOKEN_URL = LINKEDIN_REQUEST_TOKEN_URL
    ACCESS_TOKEN_URL = LINKEDIN_ACCESS_TOKEN_URL
    AUTH_BACKEND = LinkedinBackend
    SETTINGS_KEY_NAME = 'LINKEDIN_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'LINKEDIN_CONSUMER_SECRET'
    SCOPE_VAR_NAME = 'LINKEDIN_SCOPE'
    SCOPE_SEPARATOR = '+'

    def user_data(self, access_token, *args, **kwargs):
        """Return user data provided"""
        fields_selectors = LINKEDIN_FIELD_SELECTORS + \
                           setting('LINKEDIN_EXTRA_FIELD_SELECTORS', [])
        # use set() over fields_selectors since LinkedIn fails when values are
        # duplicated
        url = LINKEDIN_CHECK_AUTH + ':(%s)' % ','.join(set(fields_selectors))
        request = self.oauth_request(access_token, url)
        add_language_header(request)
        raw_xml = self.fetch_response(request)
        try:
            return to_dict(ElementTree.fromstring(raw_xml))
        except (ExpatError, KeyError, IndexError):
            return None

    def auth_complete(self, *args, **kwargs):
        """Complete auth process. Check LinkedIn error response."""
        oauth_problem = self.request.GET.get('oauth_problem')
        if oauth_problem:
            if oauth_problem == 'user_refused':
                raise AuthCanceled(self, '')
            else:
                raise AuthUnknownError(self, 'LinkedIn error was %s' %
                                                    oauth_problem)
        return super(LinkedinAuth, self).auth_complete(*args, **kwargs)

    def get_scope(self):
        """Return list with needed access scope"""
        scope = []
        if self.SCOPE_VAR_NAME:
            scope = setting(self.SCOPE_VAR_NAME, [])
        else:
            scope = []
        return scope

    def unauthorized_token(self):
        """Makes first request to oauth. Returns an unauthorized Token."""
        request_token_url = self.REQUEST_TOKEN_URL
        scope = self.get_scope()
        if scope:
            qs = 'scope=' + self.SCOPE_SEPARATOR.join(scope)
            request_token_url = request_token_url + '?' + qs

        request = self.oauth_request(
            token=None,
            url=request_token_url,
            extra_params=self.request_token_extra_arguments()
        )
        response = self.fetch_response(request)
        return Token.from_string(response)


class LinkedinOAuth2(BaseOAuth2):
    AUTH_BACKEND = LinkedinOAuth2Backend
    AUTHORIZATION_URL = 'https://www.linkedin.com/uas/oauth2/authorization'
    ACCESS_TOKEN_URL = 'https://www.linkedin.com/uas/oauth2/accessToken'
    SETTINGS_KEY_NAME = 'LINKEDIN_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'LINKEDIN_CONSUMER_SECRET'
    SCOPE_VAR_NAME = 'LINKEDIN_SCOPE'
    REDIRECT_STATE = False

    def user_data(self, access_token, *args, **kwargs):
        """Return user data provided"""
        fields_selectors = LINKEDIN_FIELD_SELECTORS + \
                           setting('LINKEDIN_EXTRA_FIELD_SELECTORS', [])
        url = LINKEDIN_CHECK_AUTH + ':(%s)' % ','.join(set(fields_selectors))
        data = {'oauth2_access_token': access_token, 'format': 'json'}
        request = Request(url + '?' + urlencode(data))
        add_language_header(request)
        try:
            return simplejson.loads(dsa_urlopen(request).read())
        except (ExpatError, KeyError, IndexError):
            return None


def to_dict(xml):
    """Convert XML structure to dict recursively, repeated keys entries
    are returned as in list containers."""
    children = xml.getchildren()
    if not children:
        return xml.text
    else:
        out = {}
        for node in xml.getchildren():
            if node.tag in out:
                if not isinstance(out[node.tag], list):
                    out[node.tag] = [out[node.tag]]
                out[node.tag].append(to_dict(node))
            else:
                out[node.tag] = to_dict(node)
        return out


# Backend definition
BACKENDS = {
    'linkedin': LinkedinAuth,
    'linkedin-oauth2': LinkedinOAuth2,
}

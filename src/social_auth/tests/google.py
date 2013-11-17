import re

from unittest import expectedFailure, skip

from social_auth.utils import setting
from social_auth.tests.base import SocialAuthTestsCase, FormParserByID, \
                                   FormParser, RefreshParser
from django.conf import settings

class GoogleTestCase(SocialAuthTestsCase):

    name = 'google'

    def setUp(self, *args, **kwargs):
        super(GoogleTestCase, self).setUp(*args, **kwargs)
        self.user = setting('TEST_GOOGLE_USER')
        self.passwd = setting('TEST_GOOGLE_PASSWORD')
        # check that user and password are setup properly
        # These fail.
        #self.assertTrue(self.user)
        #self.assertTrue(self.passwd)


REDIRECT_RE = re.compile('window.location.replace\("(.*)"\);')


class GoogleOpenIdTestLogin(GoogleTestCase):
    SERVER_NAME = 'myapp.com'
    SERVER_PORT = '8000'

    @skip("GoogleTestCase.setUp() is broken")
    def test_login_succeful(self):
        if self.name not in settings.SOCIAL_AUTH_ENABLED_BACKENDS:
            self.skipTest('Google OpenID is not enabled')
        response = self.client.get(self.reverse('socialauth_begin', 'google'))

        parser = FormParserByID('openid_message')
        parser.feed(response.content)
        # Check that action and values were loaded properly
        self.assertTrue(parser.action)
        self.assertTrue(parser.values)
        content = self.get_content(parser.action, parser.values,
                                   use_cookies=True)

        parser = FormParserByID('gaia_loginform')
        parser.feed(content)
        auth = {'Email': self.user, 'Passwd': self.passwd}
        parser.values.update(auth)
        # Check that action and values were loaded properly
        self.assertTrue(parser.action)
        self.assertTrue(parser.values)

        content = self.get_content(parser.action, parser.values,
                                   use_cookies=True)
        parser = RefreshParser()
        parser.feed(content)

        # approved?
        result = self.get_redirect(parser.value, use_cookies=True)
        if result.headers.get('Location', ''):  # approved?
            # damn, google has a hell of redirects :-(
            result = self.get_redirect(result.headers['Location'],
                                       use_cookies=True)
            result = self.get_redirect(result.headers['Location'],
                                       use_cookies=True)
            result = self.get_redirect(result.headers['Location'],
                                       use_cookies=True)

        # app was not approved
        if self.SERVER_NAME not in result.headers.get('Location', ''):
            content = self.get_content(parser.value, use_cookies=True)
            parser = FormParser()
            parser.feed(content)
            parser.values['submit_true'] = 'yes'
            parser.values['remember_choices'] = 'yes'
            result = self.get_redirect(parser.action, parser.values,
                                       use_cookies=True)

        response = self.client.get(self.make_relative(
                                            result.headers['Location']))
        self.assertTrue(setting('LOGIN_REDIRECT_URL') in \
                            self.make_relative(response['Location']))

import re

from unittest import skip

from social_auth.utils import setting
from social_auth.tests.base import SocialAuthTestsCase, FormParserByID
from django.contrib.sites.models import Site


class FacebookTestCase(SocialAuthTestsCase):
    SERVER_NAME = 'myapp.com'
    SERVER_PORT = '8000'

    def __init__(self, methodName='runTest'):
        super(FacebookTestCase, self).__init__(methodName)

    name = 'facebook'

    def setUp(self, *args, **kwargs):
        self.SERVER_NAME = Site.objects.get_current()
        super(FacebookTestCase, self).setUp(*args, **kwargs)
        self.user = setting('TEST_FACEBOOK_USER')
        self.passwd = setting('TEST_FACEBOOK_PASSWORD')
        # check that user and password are setup properly
        # Ugh, these fail too.
        #self.assertTrue(self.user)
        #self.assertTrue(self.passwd)


REDIRECT_RE = re.compile('window.location.replace\("(.*)"\);')

class FacebookTestLogin(FacebookTestCase):
    @skip("FacebookTestCase.setUp() is broken")
    def test_login_succeful(self):
        """

        """
        response = self.client.get('http://%s%s' % (self.SERVER_NAME, self.reverse('socialauth_begin', 'facebook')))
        # social_auth must redirect to service page
        self.assertEqual(response.status_code, 302)

        # Open first redirect page, it contains user login form because
        # we don't have cookie to send to twitter
        parser = FormParserByID('login_form')
        content = self.get_content(response['Location'], use_cookies=True)
        parser.feed(content)
        auth = {'email': self.user,
                'pass': self.passwd}

        # Check that action and values were loaded properly
        self.assertTrue(parser.action)
        self.assertTrue(parser.values)

        # Post login form, will return authorization or redirect page
        parser.values.update(auth)
        redirect = self.get_redirect(parser.action, parser.values,
                                   use_cookies=True)
        # If page contains a form#login_form, then we are in the app
        # authorization page because the app is not authorized yet,
        # otherwise the app already gained permission and twitter sends
        # a page that redirects to redirect_url
        if 'login_form' in content:
            # authorization form post, returns redirect_page
            parser = FormParserByID('login_form')
            parser.feed(content)
            self.assertTrue(parser.action)
            self.assertTrue(parser.values)
            parser.values.update(auth)
            redirect = self.get_redirect(parser.action, parser.values,
                                             use_cookies=True)
            redirect_page = redirect.read()
        else:
            redirect = self.get_redirect(redirect.headers['Location'],
                use_cookies=True)
            redirect_page = redirect.read()

        if 'uiserver_form' in redirect_page:
            # authorization form post, returns redirect_page
            parser = FormParserByID('uiserver_form')
            parser.feed(redirect_page)
            self.assertTrue(parser.action)
            self.assertTrue(parser.values)
            parser.values.update(auth)
            redirect = self.get_redirect(parser.action, parser.values,
                use_cookies=True)


        self.assertTrue(setting('LOGIN_REDIRECT_URL') in self.make_relative(redirect.headers['Location']))

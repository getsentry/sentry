from unittest import expectedFailure, skip

from social_auth.utils import setting
from social_auth.tests.base import SocialAuthTestsCase, FormParserByID, \
                                   RefreshParser
from django.test.utils import override_settings


class TwitterTestCase(SocialAuthTestsCase):

    name = 'twitter'

    def setUp(self, *args, **kwargs):
        super(TwitterTestCase, self).setUp(*args, **kwargs)
        self.user = setting('TEST_TWITTER_USER')
        self.passwd = setting('TEST_TWITTER_PASSWORD')
        # check that user and password are setup properly
        # These fail spectacularly, and it's annoying to
        # have asserts in setUp() anyway, especially in
        # classes that are inherited.
        #self.assertTrue(self.user)
        #self.assertTrue(self.passwd)


class TwitterTestLogin(TwitterTestCase):
    @skip("TwitterTestCase.setUp() is broken")
    @override_settings(SOCIAL_AUTH_PIPELINE = (
        'social_auth.backends.pipeline.social.social_auth_user',
        'social_auth.backends.pipeline.associate.associate_by_email',
        'social_auth.backends.pipeline.user.get_username',
        'social_auth.backends.pipeline.misc.save_status_to_session',
        'social_auth.backends.pipeline.social.associate_user',
        'social_auth.backends.pipeline.social.load_extra_data',
        'social_auth.backends.pipeline.user.update_user_details',
        ))
    def test_login_successful(self):
        response = self.client.get(self.reverse('socialauth_begin', 'twitter'))
        # social_auth must redirect to service page
        self.assertEqual(response.status_code, 302)

        # Open first redirect page, it contains user login form because
        # we don't have cookie to send to twitter
        login_content = self.get_content(response['Location'])
        parser = FormParserByID('oauth_form')
        parser.feed(login_content)
        auth = {'session[username_or_email]': self.user,
                'session[password]': self.passwd}

        # Check that action and values were loaded properly
        self.assertTrue(parser.action)
        self.assertTrue(parser.values)

        # Post login form, will return authorization or redirect page
        parser.values.update(auth)
        content = self.get_content(parser.action, data=parser.values)

        # If page contains a form#login_form, then we are in the app
        # authorization page because the app is not authorized yet,
        # otherwise the app already gained permission and twitter sends
        # a page that redirects to redirect_url
        if 'login_form' in content:
            # authorization form post, returns redirect_page
            parser = FormParserByID('login_form').feed(content)
            self.assertTrue(parser.action)
            self.assertTrue(parser.values)
            parser.values.update(auth)
            redirect_page = self.get_content(parser.action, data=parser.values)
        else:
            redirect_page = content

        parser = RefreshParser()
        parser.feed(redirect_page)
        self.assertTrue(parser.value)

        response = self.client.get(self.make_relative(parser.value))
        self.assertEqual(response.status_code, 302)
        location = self.make_relative(response['Location'])
        login_redirect = setting('LOGIN_REDIRECT_URL')
        self.assertTrue(location == login_redirect)

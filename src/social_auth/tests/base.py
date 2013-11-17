import re
import urllib2
import cookielib
import urllib
import urlparse
import unittest
from sgmllib import SGMLParser
from django.conf import settings

from django.test.client import Client
from django.core.urlresolvers import reverse


USER_AGENT = 'Mozilla/5.0'
REFRESH_RE = re.compile(r'\d;\s*url=')


class SocialAuthTestsCase(unittest.TestCase):
    """Base class for social auth tests"""
    SERVER_NAME = None
    SERVER_PORT = None

    def __init__(self, *args, **kwargs):
        client_kwargs = {}
        if self.SERVER_NAME:
            client_kwargs['SERVER_NAME'] = self.SERVER_NAME
        if self.SERVER_PORT:
            client_kwargs['SERVER_PORT'] = self.SERVER_PORT
        self.jar = None
        self.client = Client(**client_kwargs)
        super(SocialAuthTestsCase, self).__init__(*args, **kwargs)

    def setUp(self):
        from social_auth import backends
        self.old_PIPELINE = backends.PIPELINE
        backends.PIPELINE = (
                'social_auth.backends.pipeline.social.social_auth_user',
                'social_auth.backends.pipeline.associate.associate_by_email',
                'social_auth.backends.pipeline.user.get_username',
                'social_auth.backends.pipeline.user.create_user',
                'social_auth.backends.pipeline.social.associate_user',
                'social_auth.backends.pipeline.social.load_extra_data',
                'social_auth.backends.pipeline.user.update_user_details',
                )
        super(SocialAuthTestsCase, self).setUp()

    def tearDown(self):
        from social_auth import backends
        backends.PIPELINE = self.old_PIPELINE
        super(SocialAuthTestsCase, self).tearDown()

    def test_backend_cache(self):
        """Ensure that the backend for the testcase gets cached."""
        try:
            self.name
        except AttributeError:
            pass
        else:
            if self.name not in settings.SOCIAL_AUTH_ENABLED_BACKENDS:
                # this backend is not enabled (for example, google-openid/google-oauth2)
                return
            from social_auth import backends
            backends.BACKENDS = {}
            self.client.get(self.reverse('socialauth_begin', self.name))
            self.assertTrue(self.name in backends.BACKENDSCACHE)

    def get_content(self, url, data=None, use_cookies=False):
        """Return content for given url, if data is not None, then a POST
        request will be issued, otherwise GET will be used"""
        data = data and urllib.urlencode(data, doseq=True) or data
        request = urllib2.Request(url)
        agent = urllib2.build_opener()

        if use_cookies:
            agent.add_handler(urllib2.HTTPCookieProcessor(self.get_jar()))
        request.add_header('User-Agent', USER_AGENT)
        return ''.join(agent.open(request, data=data).readlines())

    def get_redirect(self, url, data=None, use_cookies=False):
        """Return content for given url, if data is not None, then a POST
        request will be issued, otherwise GET will be used"""
        data = data and urllib.urlencode(data, doseq=True) or data
        request = urllib2.Request(url)
        agent = urllib2.build_opener(RedirectHandler())

        if use_cookies:
            agent.add_handler(urllib2.HTTPCookieProcessor(self.get_jar()))
        request.add_header('User-Agent', USER_AGENT)
        return agent.open(request, data=data)

    def get_jar(self):
        if not self.jar:
            self.jar = cookielib.CookieJar()
        return self.jar

    def reverse(self, name, backend):
        """Reverses backend URL by name"""
        return reverse(name, args=(backend,))

    def make_relative(self, value):
        """Converst URL to relative, useful for server responses"""
        parsed = urlparse.urlparse(value)
        return urlparse.urlunparse(('', '', parsed.path, parsed.params,
                                    parsed.query, parsed.fragment))


class CustomParser(SGMLParser):
    """Custom SGMLParser that closes the parser once it's fed"""
    def feed(self, data):
        SGMLParser.feed(self, data)
        self.close()


class FormParser(CustomParser):
    """Form parser, load form data and action for given form"""
    def __init__(self, *args, **kwargs):
        CustomParser.__init__(self, *args, **kwargs)
        self.inside_form = False
        self.action = None
        self.values = {}

    def start_form(self, attributes):
        """Start form parsing detecting if form is the one requested"""
        attrs = dict(attributes)
        if self.in_form(attrs):
            # flag that we are inside the form and save action
            self.inside_form = True
            self.action = attrs.get('action')

    def in_form(self, attrs):
        """Override below"""
        return True

    def end_form(self):
        """End form parsing, unset inside_form flag"""
        self.inside_form = False

    def start_input(self, attributes):
        """Parse input fields, we only keep data for fields of type text,
        hidden or password and that has a valid name."""
        attrs = dict(attributes)
        if self.inside_form:
            type, name, value = attrs.get('type'), attrs.get('name'), \
                                attrs.get('value')
            if name and type in ('text', 'hidden', 'password'):
                self.values[name] = value


class FormParserByID(FormParser):
    """Form parser, load form data and action for given form identified
    by its id"""
    def __init__(self, form_id, *args, **kwargs):
        FormParser.__init__(self, *args, **kwargs)
        self.form_id = form_id

    def in_form(self, attrs):
        return attrs.get('id') == self.form_id


class RefreshParser(CustomParser):
    """Refresh parser, will check refresh by meta tag and store refresh URL"""
    def __init__(self, *args, **kwargs):
        CustomParser.__init__(self, *args, **kwargs)
        self.value = None

    def start_meta(self, attributes):
        """Start meta parsing checking by http-equiv attribute"""
        attrs = dict(attributes)
        if attrs.get('http-equiv') == 'refresh':
            self.value = REFRESH_RE.sub('', attrs.get('content')).strip("'")


class RedirectHandler(urllib2.HTTPRedirectHandler):
    def http_error_302(self, req, fp, code, msg, headers):
        return fp

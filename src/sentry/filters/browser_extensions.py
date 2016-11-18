from __future__ import absolute_import

from .base import Filter

import re

EXTENSION_EXC_VALUES = re.compile('|'.join((re.escape(x) for x in (
    # Random plugins/extensions
    'top.GLOBALS',
    # See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error. html
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    'http://tt.epicplay.com',
    'Can\'t find variable: ZiteReader',
    'jigsaw is not defined',
    'ComboSearch is not defined',
    'http://loading.retry.widdit.com/',
    'atomicFindClose',
    # Facebook borked
    'fb_xd_fragment',
    # ISP "optimizing" proxy - `Cache-Control: no-transform` seems to
    # reduce this. (thanks @acdha)
    # See http://stackoverflow.com/questions/4113268
    'bmi_SafeAddOnload',
    'EBCallBackMessageReceived',
    # See https://groups.google.com/a/chromium.org/forum/#!topic/chromium-discuss/7VU0_VvC7mE
    '_gCrWeb',
    # See http://toolbar.conduit.com/Developer/HtmlAndGadget/Methods/JSInjection.aspx
    'conduitPage'
))), re.I)

EXTENSION_EXC_SOURCES = re.compile('|'.join((
    # Facebook flakiness
    r'graph\.facebook\.com'
    # Facebook blocked
    r'connect\.facebook\.net\/en_US\/all\.js',
    # Woopra flakiness
    r'eatdifferent\.com\.woopra-ns\.com',
    r'static\.woopra\.com\/js\/woopra\.js',
    # Chrome extensions
    r'^chrome(?:-extension)?:\/\/',
    # Cacaoweb
    r'127\.0\.0\.1:4001\/isrunning',
    # Other
    r'webappstoolbarba\.texthelp\.com\/',
    r'metrics\.itunes\.apple\.com\.edgesuite\.net\/',
)), re.I)


class BrowserExtensionsFilter(Filter):
    id = 'browser-extensions'
    name = 'Filter out errors known to be caused by browser extensions'
    description = 'Certain browser extensions will inject inline scripts and are known to cause errors.'

    def get_exception_value(self, data):
        try:
            return data['sentry.interfaces.Exception']['values'][0]['value']
        except (LookupError, TypeError):
            return ''

    def get_exception_source(self, data):
        try:
            return data['sentry.interfaces.Exception']['values'][0]['stacktrace']['frames'][-1]['abs_path']
        except (LookupError, TypeError):
            return ''

    def test(self, data):
        """
        Test the exception value to determine if it looks like the error is
        caused by a common browser extension.
        """
        if data.get('platform') != 'javascript':
            return False

        exc_value = self.get_exception_value(data)
        if exc_value:
            if EXTENSION_EXC_VALUES.search(exc_value):
                return True

        exc_source = self.get_exception_source(data)
        if exc_source:
            if EXTENSION_EXC_SOURCES.match(exc_source):
                return True

        return False

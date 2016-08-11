from __future__ import absolute_import

from .base import Filter

import re

EXTENSION_EXC_VALUES = (
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
    # See http://toolbar.conduit.com/Developer/HtmlAndGadget/Methods/JSInjection.aspx
    'conduitPage'
)

EXTENSION_EXC_SOURCES = (
    # Facebook flakiness
    re.compile(r'graph\.facebook\.com', re.I),
    # Facebook blocked
    re.compile(r'connect\.facebook\.net\/en_US\/all\.js', re.I),
    # Woopra flakiness
    re.compile(r'eatdifferent\.com\.woopra-ns\.com', re.I),
    re.compile(r'static\.woopra\.com\/js\/woopra\.js', re.I),
    # Chrome extensions
    re.compile(r'extensions\/', re.I),
    re.compile(r'^chrome:\/\/', re.I),
    # Cacaoweb
    re.compile(r'127\.0\.0\.1:4001\/isrunning', re.I),
    # Other
    re.compile(r'webappstoolbarba\.texthelp\.com\/', re.I),
    re.compile(r'metrics\.itunes\.apple\.com\.edgesuite\.net\/', re.I),
)


class BrowserExtensionsFilter(Filter):
    id = 'browser-extensions'
    name = 'Filter out known errors caused by browser extensions'

    def get_exception_value(self, data):
        try:
            return data['sentry.interfaces.Exception']['values'][0]['value']
        except (KeyError, IndexError):
            return ''

    def get_exception_source(self, data):
        try:
            return data['sentry.interfaces.Exception']['values'][0]['stacktrace']['frames'][-1]['abs_path']
        except (KeyError, IndexError):
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
            for match in EXTENSION_EXC_VALUES:
                if match in exc_value:
                    return True

        exc_source = self.get_exception_source(data)
        if exc_source:
            for pattern in EXTENSION_EXC_SOURCES:
                if pattern.match(exc_source):
                    return True

        return False

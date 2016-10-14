from __future__ import absolute_import

import six
from string import Formatter


class dontexplodedict(object):
    """
    A dictionary that won't throw a KeyError and will
    return back a sensible default value to be used in
    string formatting.
    """
    def __init__(self, d=None):
        self.data = d or {}

    def __getitem__(self, key):
        return self.data.get(key, '')


class EventError(object):
    INVALID_DATA = 'invalid_data'
    INVALID_ATTRIBUTE = 'invalid_attribute'
    VALUE_TOO_LONG = 'value_too_long'
    UNKNOWN_ERROR = 'unknown_error'
    SECURITY_VIOLATION = 'security_violation'
    RESTRICTED_IP = 'restricted_ip'

    JS_GENERIC_FETCH_ERROR = 'js_generic_fetch_error'
    JS_INVALID_HTTP_CODE = 'js_invalid_http_code'
    JS_INVALID_CONTENT = 'js_invalid_content'
    JS_NO_COLUMN = 'js_no_column'
    JS_MISSING_SOURCE = 'js_no_source'
    JS_INVALID_SOURCEMAP = 'js_invalid_source'
    JS_TOO_MANY_REMOTE_SOURCES = 'js_too_many_sources'
    JS_INVALID_SOURCE_ENCODING = 'js_invalid_source_encoding'
    JS_INVALID_SOURCEMAP_LOCATION = 'js_invalid_sourcemap_location'
    JS_TOO_LARGE = 'js_too_large'
    JS_FETCH_TIMEOUT = 'js_fetch_timeout'
    NATIVE_NO_CRASHED_THREAD = 'native_no_crashed_thread'
    NATIVE_INTERNAL_FAILURE = 'native_internal_failure'
    NATIVE_NO_SYMSYND = 'native_no_symsynd'

    _messages = {
        INVALID_DATA: u'Discarded invalid value for parameter \'{name}\'',
        INVALID_ATTRIBUTE: u'Discarded invalid parameter \'{name}\'',
        VALUE_TOO_LONG: u'Discarded value for \'{name}\' due to exceeding maximum length',
        UNKNOWN_ERROR: u'Unknown error',
        SECURITY_VIOLATION: u'Cannot fetch resource due to security violation on {url}',
        RESTRICTED_IP: u'Cannot fetch resource due to restricted IP address on {url}',
        JS_GENERIC_FETCH_ERROR: u'Unable to fetch resource: {url}',
        JS_INVALID_HTTP_CODE: u'HTTP returned {value} response on {url}',
        JS_INVALID_CONTENT: u'Source file was not JavaScript: {url}',
        JS_NO_COLUMN: u'Cannot expand sourcemap due to no column information for {url}',
        JS_MISSING_SOURCE: u'Source code was not found for {url}',
        JS_INVALID_SOURCEMAP: u'Sourcemap was invalid or not parseable: {url}',
        JS_TOO_MANY_REMOTE_SOURCES: u'The maximum number of remote source requests was made',
        JS_INVALID_SOURCE_ENCODING: u'Source file was not \'{value}\' encoding: {url}',
        JS_INVALID_SOURCEMAP_LOCATION: u'Invalid location in sourcemap: ({column}, {row})',
        JS_TOO_LARGE: u'Remote file too large: ({max_size:g}MB, {url})',
        JS_FETCH_TIMEOUT: u'Remote file took too long to load: ({timeout}s, {url})',
        NATIVE_NO_CRASHED_THREAD: u'No crashed thread found in crash report',
        NATIVE_INTERNAL_FAILURE: u'Internal failure when attempting to symbolicate: {error}',
        NATIVE_NO_SYMSYND: u'The symbolizer is not configured for this system.',
    }

    @classmethod
    def get_message(cls, data):
        return Formatter().vformat(
            cls._messages[data['type']],
            [],
            dontexplodedict(data),
        )

    def to_dict(self):
        return {k: v for k, v in six.iteritems(self) if k != 'type'}

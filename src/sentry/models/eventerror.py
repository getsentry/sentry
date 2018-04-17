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
    MISSING_ATTRIBUTE = 'missing_attribute'
    VALUE_TOO_LONG = 'value_too_long'
    UNKNOWN_ERROR = 'unknown_error'
    SECURITY_VIOLATION = 'security_violation'
    RESTRICTED_IP = 'restricted_ip'
    FUTURE_TIMESTAMP = 'future_timestamp'
    PAST_TIMESTAMP = 'past_timestamp'

    JS_GENERIC_FETCH_ERROR = 'js_generic_fetch_error'  # deprecated in favor of FETCH_GENERIC_ERROR
    FETCH_GENERIC_ERROR = 'fetch_generic_error'
    JS_INVALID_HTTP_CODE = 'js_invalid_http_code'  # deprecated in favor of FETCH_INVALID_HTTP_CODE
    FETCH_INVALID_HTTP_CODE = 'fetch_invalid_http_code'
    JS_INVALID_CONTENT = 'js_invalid_content'
    JS_NO_COLUMN = 'js_no_column'
    JS_MISSING_SOURCE = 'js_no_source'
    JS_INVALID_SOURCEMAP = 'js_invalid_source'
    JS_TOO_MANY_REMOTE_SOURCES = 'js_too_many_sources'
    JS_INVALID_SOURCE_ENCODING = 'js_invalid_source_encoding'
    FETCH_INVALID_ENCODING = 'fetch_invalid_source_encoding'
    JS_INVALID_SOURCEMAP_LOCATION = 'js_invalid_sourcemap_location'
    JS_TOO_LARGE = 'js_too_large'  # deprecated in favor of FETCH_TOO_LARGE
    FETCH_TOO_LARGE = 'fetch_too_large'
    JS_FETCH_TIMEOUT = 'js_fetch_timeout'  # deprecated in favor of FETCH_TIMEOUT
    FETCH_TIMEOUT = 'fetch_timeout'
    NATIVE_NO_CRASHED_THREAD = 'native_no_crashed_thread'
    NATIVE_INTERNAL_FAILURE = 'native_internal_failure'
    NATIVE_BAD_DSYM = 'native_bad_dsym'
    NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM = 'native_optionally_bundled_dsym'
    NATIVE_MISSING_DSYM = 'native_missing_dsym'
    NATIVE_MISSING_SYSTEM_DSYM = 'native_missing_system_dsym'
    NATIVE_MISSING_SYMBOL = 'native_missing_symbol'
    NATIVE_SIMULATOR_FRAME = 'native_simulator_frame'
    NATIVE_UNKNOWN_IMAGE = 'native_unknown_image'
    PROGUARD_MISSING_MAPPING = 'proguard_missing_mapping'
    PROGUARD_MISSING_LINENO = 'proguard_missing_lineno'

    _messages = {
        INVALID_DATA: u'Discarded invalid value for parameter \'{name}\'',
        INVALID_ATTRIBUTE: u'Discarded invalid parameter \'{name}\'',
        MISSING_ATTRIBUTE: u'Missing value for required parameter \'{name}\'',
        VALUE_TOO_LONG: u'Discarded value for \'{name}\' due to exceeding maximum length',
        UNKNOWN_ERROR: u'Unknown error',
        SECURITY_VIOLATION: u'Cannot fetch resource due to security violation on {url}',
        RESTRICTED_IP: u'Cannot fetch resource due to restricted IP address on {url}',
        FUTURE_TIMESTAMP: u'Invalid timestamp (in future)',
        PAST_TIMESTAMP: u'Invalid timestamp (too old)',
        # deprecated in favor of FETCH_GENERIC_ERROR
        JS_GENERIC_FETCH_ERROR: u'Unable to fetch resource: {url}',
        FETCH_GENERIC_ERROR: u'Unable to fetch resource: {url}',
        JS_INVALID_HTTP_CODE: u'HTTP returned {value} response on {url}',
        # deprecated in favor of FETCH_INVALID_HTTP_CODE
        FETCH_INVALID_HTTP_CODE: u'HTTP returned {value} response on {url}',
        JS_INVALID_CONTENT: u'Source file was not JavaScript: {url}',
        JS_NO_COLUMN: u'Cannot expand sourcemap due to no column information for {url}',
        JS_MISSING_SOURCE: u'Source code was not found for {url}',
        JS_INVALID_SOURCEMAP: u'Sourcemap was invalid or not parseable: {url}',
        JS_TOO_MANY_REMOTE_SOURCES: u'The maximum number of remote source requests was made',
        JS_INVALID_SOURCE_ENCODING: u'Source file was not \'{value}\' encoding: {url}',
        FETCH_INVALID_ENCODING: u'Source file was not \'{value}\' encoding: {url}',
        JS_INVALID_SOURCEMAP_LOCATION: u'Invalid location in sourcemap: ({column}, {row})',
        # deprecated in favor of FETCH_TOO_LARGE
        JS_TOO_LARGE: u'Remote file too large: ({max_size:g}MB, {url})',
        FETCH_TOO_LARGE: u'Remote file too large: ({max_size:g}MB, {url})',
        # deprecated in favor of FETCH_TIMEOUT
        JS_FETCH_TIMEOUT: u'Remote file took too long to load: ({timeout}s, {url})',
        FETCH_TIMEOUT: u'Remote file took too long to load: ({timeout}s, {url})',
        NATIVE_NO_CRASHED_THREAD: u'No crashed thread found in crash report',
        NATIVE_INTERNAL_FAILURE: u'Internal failure when attempting to symbolicate: {error}',
        NATIVE_BAD_DSYM: u'The debug information file used was broken.',
        NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM: u'An optional debug information file was missing.',
        NATIVE_MISSING_DSYM: u'A required debug information file was missing.',
        NATIVE_MISSING_SYSTEM_DSYM: u'A system debug information file was missing.',
        NATIVE_MISSING_SYMBOL: u'Unable to resolve a symbol.',
        NATIVE_SIMULATOR_FRAME: u'Encountered an unprocessable simulator frame.',
        NATIVE_UNKNOWN_IMAGE: u'A binary image is referenced that is unknown.',
        PROGUARD_MISSING_MAPPING: u'A proguard mapping file was missing.',
        PROGUARD_MISSING_LINENO: u'A proguard mapping file does not contain line info.',
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

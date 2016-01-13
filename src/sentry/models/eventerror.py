from __future__ import absolute_import


class EventError(object):
    INVALID_DATA = 'invalid_data'
    INVALID_ATTRIBUTE = 'invalid_attribute'
    VALUE_TOO_LONG = 'value_too_long'
    UNKNOWN_ERROR = 'unknown_error'
    SECURITY_VIOLATION = 'security_violation'
    RESTRICTED_IP = 'restricted_ip'

    JS_GENERIC_FETCH_ERROR = 'js_generic_fetch_error'
    JS_INVALID_HTTP_CODE = 'js_invalid_http_code'
    JS_NO_COLUMN = 'js_no_column'
    JS_MISSING_SOURCE = 'js_no_source'
    JS_INVALID_SOURCEMAP = 'js_invalid_source'
    JS_TOO_MANY_REMOTE_SOURCES = 'js_too_many_sources'
    JS_INVALID_SOURCE_ENCODING = 'js_invalid_source_encoding'
    JS_INVALID_SOURCEMAP_LOCATION = 'js_invalid_sourcemap_location'

    _messages = {
        INVALID_DATA: 'Discarded invalid value for parameter \'{name}\'',
        INVALID_ATTRIBUTE: 'Discarded invalid parameter \'{name}\'',
        VALUE_TOO_LONG: 'Discarded value for \'{name}\' due to exceeding maximum length',
        UNKNOWN_ERROR: 'Unknown error',
        SECURITY_VIOLATION: 'Cannot fetch resource due to security violation on {url}',
        RESTRICTED_IP: 'Cannot fetch resource due to restricted IP address on {url}',
        JS_GENERIC_FETCH_ERROR: 'Unable to fetch resource: {url}',
        JS_INVALID_HTTP_CODE: 'HTTP returned {value} response on {url}',
        JS_NO_COLUMN: 'Cannot expand sourcemap due to no column information for {url}',
        JS_MISSING_SOURCE: 'Source code was not found for {url}',
        JS_INVALID_SOURCEMAP: 'Sourcemap was invalid or not parseable: {url}',
        JS_TOO_MANY_REMOTE_SOURCES: 'The maximum number of remote source requests was made',
        JS_INVALID_SOURCE_ENCODING: 'Source file was not \'{value}\' encoding: {url}',
        JS_INVALID_SOURCEMAP_LOCATION: 'Invalid location in sourcemap: ({column}, {row})',
    }

    @classmethod
    def get_message(cls, data):
        return cls._messages[data['type']].format(**data)

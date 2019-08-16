from __future__ import absolute_import

import six


class EventError(object):
    # Generic
    UNKNOWN_ERROR = "unknown_error"

    # Schema validation
    INVALID_DATA = "invalid_data"
    INVALID_ATTRIBUTE = "invalid_attribute"
    MISSING_ATTRIBUTE = "missing_attribute"
    VALUE_TOO_LONG = "value_too_long"
    FUTURE_TIMESTAMP = "future_timestamp"
    PAST_TIMESTAMP = "past_timestamp"
    INVALID_ENVIRONMENT = "invalid_environment"

    # Processing: Http
    SECURITY_VIOLATION = "security_violation"
    RESTRICTED_IP = "restricted_ip"
    FETCH_GENERIC_ERROR = "fetch_generic_error"
    FETCH_INVALID_HTTP_CODE = "fetch_invalid_http_code"
    FETCH_INVALID_ENCODING = "fetch_invalid_source_encoding"
    FETCH_TOO_LARGE = "fetch_too_large"
    FETCH_TIMEOUT = "fetch_timeout"

    # Processing: JavaScript
    JS_GENERIC_FETCH_ERROR = "js_generic_fetch_error"  # deprecated in favor of FETCH_GENERIC_ERROR
    JS_INVALID_HTTP_CODE = "js_invalid_http_code"  # deprecated in favor of FETCH_INVALID_HTTP_CODE
    JS_INVALID_CONTENT = "js_invalid_content"
    JS_NO_COLUMN = "js_no_column"
    JS_MISSING_SOURCE = "js_no_source"
    JS_INVALID_SOURCEMAP = "js_invalid_source"
    JS_TOO_MANY_REMOTE_SOURCES = "js_too_many_sources"
    JS_INVALID_SOURCE_ENCODING = "js_invalid_source_encoding"
    JS_INVALID_SOURCEMAP_LOCATION = "js_invalid_sourcemap_location"
    JS_TOO_LARGE = "js_too_large"  # deprecated in favor of FETCH_TOO_LARGE
    JS_FETCH_TIMEOUT = "js_fetch_timeout"  # deprecated in favor of FETCH_TIMEOUT

    # Processing: Native
    NATIVE_NO_CRASHED_THREAD = "native_no_crashed_thread"
    NATIVE_INTERNAL_FAILURE = "native_internal_failure"
    NATIVE_BAD_DSYM = "native_bad_dsym"
    NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM = "native_optionally_bundled_dsym"
    NATIVE_MISSING_DSYM = "native_missing_dsym"
    NATIVE_MISSING_SYSTEM_DSYM = "native_missing_system_dsym"
    NATIVE_MISSING_SYMBOL = "native_missing_symbol"
    NATIVE_SIMULATOR_FRAME = "native_simulator_frame"
    NATIVE_UNKNOWN_IMAGE = "native_unknown_image"
    NATIVE_SYMBOLICATOR_FAILED = "native_symbolicator_failed"

    # Processing: Proguard
    PROGUARD_MISSING_MAPPING = "proguard_missing_mapping"
    PROGUARD_MISSING_LINENO = "proguard_missing_lineno"

    _messages = {
        UNKNOWN_ERROR: u"Unknown error",
        INVALID_DATA: u"Discarded invalid value",
        INVALID_ATTRIBUTE: u"Discarded unknown attribute",
        MISSING_ATTRIBUTE: u"Missing value for required attribute",
        VALUE_TOO_LONG: u"Discarded value due to exceeding maximum length",
        FUTURE_TIMESTAMP: u"Invalid timestamp (in future)",
        PAST_TIMESTAMP: u"Invalid timestamp (too old)",
        INVALID_ENVIRONMENT: u'Environment cannot contain "/" or newlines',
        SECURITY_VIOLATION: u"Cannot fetch resource due to security violation",
        RESTRICTED_IP: u"Cannot fetch resource due to restricted IP address",
        FETCH_GENERIC_ERROR: u"Unable to fetch HTTP resource",
        FETCH_INVALID_HTTP_CODE: u"HTTP returned error response",
        FETCH_INVALID_ENCODING: u"Source file was not encoded properly",
        FETCH_TOO_LARGE: u"Remote file too large",
        FETCH_TIMEOUT: u"Remote file took too long to load",
        JS_GENERIC_FETCH_ERROR: u"Unable to fetch resource",
        JS_INVALID_HTTP_CODE: u"HTTP returned error response",
        JS_INVALID_CONTENT: u"Source file was not JavaScript",
        JS_NO_COLUMN: u"Cannot expand sourcemap due to missing column information",
        JS_MISSING_SOURCE: u"Source code was not found",
        JS_INVALID_SOURCEMAP: u"Sourcemap was invalid or not parseable",
        JS_TOO_MANY_REMOTE_SOURCES: u"The maximum number of remote source requests was made",
        JS_INVALID_SOURCE_ENCODING: u"Source file was not encoded properly",
        JS_INVALID_SOURCEMAP_LOCATION: u"Invalid location in sourcemap",
        JS_TOO_LARGE: u"Remote file too large",
        JS_FETCH_TIMEOUT: u"Remote file took too long to load",
        NATIVE_NO_CRASHED_THREAD: u"No crashed thread found in crash report",
        NATIVE_INTERNAL_FAILURE: u"Internal failure when attempting to symbolicate",
        NATIVE_BAD_DSYM: u"The debug information file used was broken.",
        NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM: u"An optional debug information file was missing.",
        NATIVE_MISSING_DSYM: u"A required debug information file was missing.",
        NATIVE_MISSING_SYSTEM_DSYM: u"A system debug information file was missing.",
        NATIVE_MISSING_SYMBOL: u"Could not resolve one or more frames in debug information file.",
        NATIVE_SIMULATOR_FRAME: u"Encountered an unprocessable simulator frame.",
        NATIVE_UNKNOWN_IMAGE: u"A binary image is referenced that is unknown.",
        NATIVE_SYMBOLICATOR_FAILED: u"Failed to process native stacktraces.",
        PROGUARD_MISSING_MAPPING: u"A proguard mapping file was missing.",
        PROGUARD_MISSING_LINENO: u"A proguard mapping file does not contain line info.",
    }

    @classmethod
    def get_message(cls, data):
        return cls(data).message

    def __init__(self, data):
        self._data = data

    @property
    def type(self):
        return self._data["type"]

    @property
    def data(self):
        return {k: v for k, v in six.iteritems(self._data) if k != "type"}

    @property
    def message(self):
        return self._messages.get(self._data["type"], self._messages["unknown_error"])

    def get_api_context(self):
        return {"type": self.type, "message": self.message, "data": self.data}

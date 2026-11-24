from __future__ import annotations

import enum
from typing import Annotated, Any, TypedDict, cast

from sentry.apidocs.descriptions import ApiDescription


class EventErrorType(enum.StrEnum):
    # Generic
    UNKNOWN_ERROR = "unknown_error"

    # Schema validation
    INVALID_DATA = "invalid_data"
    INVALID_ATTRIBUTE = "invalid_attribute"
    MISSING_ATTRIBUTE = "missing_attribute"
    VALUE_TOO_LONG = "value_too_long"
    FUTURE_TIMESTAMP = "future_timestamp"
    PAST_TIMESTAMP = "past_timestamp"
    CLOCK_DRIFT = "clock_drift"
    INVALID_ENVIRONMENT = "invalid_environment"

    # Processing: Http
    SECURITY_VIOLATION = "security_violation"
    RESTRICTED_IP = "restricted_ip"
    FETCH_GENERIC_ERROR = "fetch_generic_error"
    FETCH_INVALID_HTTP_CODE = "fetch_invalid_http_code"
    FETCH_INVALID_ENCODING = "fetch_invalid_source_encoding"
    FETCH_TOO_LARGE = "fetch_too_large"
    FETCH_TIMEOUT = "fetch_timeout"
    TOO_LARGE_FOR_CACHE = "too_large_for_cache"

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
    JS_MISSING_SOURCES_CONTENT = "js_missing_sources_content"
    JS_SCRAPING_DISABLED = "js_scraping_disabled"

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
    NATIVE_UNSUPPORTED_DSYM = "native_unsupported_dsym"

    # Processing: Proguard
    PROGUARD_MISSING_MAPPING = "proguard_missing_mapping"
    PROGUARD_MISSING_LINENO = "proguard_missing_lineno"


class EventErrorData(TypedDict, total=False):
    """
    Fields of `EventErrorData.data` in static/app/components/events/interfaces/types.tsx,
    plus the ones Relay's event processing error and the native and JavaScript processors
    set. Other keys depend on the error type, and Relay's `value`, the discarded original
    value, can be any JSON.
    """

    name: Annotated[str | None, ApiDescription("Affected key or path in the event")]
    message: Annotated[str, ApiDescription("Details of the error from the processor that hit it")]
    url: Annotated[str, ApiDescription("URL that couldn't be fetched, such as a source file")]
    image_path: Annotated[str, ApiDescription("Path of the debug image the error is about")]
    image_name: Annotated[str, ApiDescription("Name of the debug image the error is about")]
    image_uuid: Annotated[str, ApiDescription("Debug ID of the image the error is about")]
    image_arch: Annotated[str, ApiDescription("CPU architecture of the image the error is about")]
    symbolicator_type: Annotated[
        str, ApiDescription("Error type Symbolicator reported, such as missing_source")
    ]
    source: Annotated[str, ApiDescription("Source file or URL the error is about")]
    sourcemap: Annotated[str, ApiDescription("Source map the error is about")]
    row: Annotated[int, ApiDescription("Line of the location that couldn't be mapped")]
    column: Annotated[int, ApiDescription("Column of the location that couldn't be mapped")]
    sdk_time: Annotated[str, ApiDescription("Time the SDK reported, for clock drift errors")]
    server_time: Annotated[
        str, ApiDescription("Time the server received the event, for clock drift errors")
    ]


class EventErrorApiContext(TypedDict):
    type: Annotated[
        str, ApiDescription("Type of the processing error, such as invalid_data or js_no_source")
    ]
    message: Annotated[str, ApiDescription("Human-readable message of the error")]
    data: Annotated[
        EventErrorData,
        ApiDescription(
            "Details of the error, such as the name of the invalid field. Other keys depend on "
            "the error type"
        ),
    ]


ErrorData = dict[str, Any]


class EventError:
    _messages: dict[str, str] = {
        EventErrorType.UNKNOWN_ERROR: "Unknown error",
        EventErrorType.INVALID_DATA: "Discarded invalid value",
        EventErrorType.INVALID_ATTRIBUTE: "Discarded unknown attribute",
        EventErrorType.MISSING_ATTRIBUTE: "Missing value for required attribute",
        EventErrorType.VALUE_TOO_LONG: "Discarded value due to exceeding maximum length",
        EventErrorType.FUTURE_TIMESTAMP: "Invalid timestamp (in future)",
        EventErrorType.PAST_TIMESTAMP: "Invalid timestamp (too old)",
        EventErrorType.CLOCK_DRIFT: "Clock drift detected in SDK",
        EventErrorType.INVALID_ENVIRONMENT: 'Environment cannot contain "/" or newlines',
        EventErrorType.SECURITY_VIOLATION: "Cannot fetch resource due to security violation",
        EventErrorType.RESTRICTED_IP: "Cannot fetch resource due to restricted IP address",
        EventErrorType.FETCH_GENERIC_ERROR: "Unable to fetch HTTP resource",
        EventErrorType.FETCH_INVALID_HTTP_CODE: "HTTP returned error response",
        EventErrorType.FETCH_INVALID_ENCODING: "Source file was not encoded properly",
        EventErrorType.FETCH_TOO_LARGE: "Remote file too large for downloading",
        EventErrorType.FETCH_TIMEOUT: "Remote file took too long to load",
        EventErrorType.TOO_LARGE_FOR_CACHE: "Remote file too large for caching",
        EventErrorType.JS_GENERIC_FETCH_ERROR: "Unable to fetch resource",
        EventErrorType.JS_INVALID_HTTP_CODE: "HTTP returned error response",
        EventErrorType.JS_INVALID_CONTENT: "Source file was not JavaScript",
        EventErrorType.JS_NO_COLUMN: "Cannot expand sourcemap due to missing column information",
        EventErrorType.JS_MISSING_SOURCE: "Source code was not found",
        EventErrorType.JS_INVALID_SOURCEMAP: "Sourcemap was invalid or not parseable",
        EventErrorType.JS_TOO_MANY_REMOTE_SOURCES: "The maximum number of remote source requests was made",
        EventErrorType.JS_INVALID_SOURCE_ENCODING: "Source file was not encoded properly",
        EventErrorType.JS_INVALID_SOURCEMAP_LOCATION: "Invalid location in sourcemap",
        EventErrorType.JS_TOO_LARGE: "Remote file too large",
        EventErrorType.JS_FETCH_TIMEOUT: "Remote file took too long to load",
        EventErrorType.JS_SCRAPING_DISABLED: "Javascript scraping was disabled",
        EventErrorType.NATIVE_NO_CRASHED_THREAD: "No crashed thread found in crash report",
        EventErrorType.NATIVE_INTERNAL_FAILURE: "Internal failure when attempting to symbolicate",
        EventErrorType.NATIVE_BAD_DSYM: "The debug information file used was broken.",
        EventErrorType.NATIVE_UNSUPPORTED_DSYM: "The debug information file is not supported",
        EventErrorType.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM: "An optional debug information file was missing.",
        EventErrorType.NATIVE_MISSING_DSYM: "A required debug information file was missing.",
        EventErrorType.NATIVE_MISSING_SYSTEM_DSYM: "A system debug information file was missing.",
        EventErrorType.NATIVE_MISSING_SYMBOL: "Could not resolve one or more frames in debug information file.",
        EventErrorType.NATIVE_SIMULATOR_FRAME: "Encountered an unprocessable simulator frame.",
        EventErrorType.NATIVE_UNKNOWN_IMAGE: "A binary image is referenced that is unknown.",
        EventErrorType.NATIVE_SYMBOLICATOR_FAILED: "Failed to process native stacktraces.",
        EventErrorType.PROGUARD_MISSING_MAPPING: "A proguard mapping file was missing.",
        EventErrorType.PROGUARD_MISSING_LINENO: "A proguard mapping file does not contain line info.",
    }

    @classmethod
    def get_message(cls, data: ErrorData) -> str:
        return cls(data).message

    def __init__(self, data: ErrorData) -> None:
        self._data = data

    @property
    def type(self) -> str:
        error_type = self._data["type"]
        return error_type

    @property
    def data(self) -> ErrorData:
        return {k: v for k, v in self._data.items() if k != "type"}

    @property
    def message(self) -> str:
        return self._messages.get(self._data["type"], self._messages["unknown_error"])

    def get_api_context(self) -> EventErrorApiContext:
        return {
            "type": self.type,
            "message": self.message,
            "data": cast(EventErrorData, self.data),
        }

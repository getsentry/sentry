from typing import Annotated, TypedDict

from sentry.apidocs.descriptions import ApiDescription


class EventMetadataSdkResponse(TypedDict):
    name: Annotated[str, ApiDescription("Name of the SDK, or unknown")]
    name_normalized: Annotated[str, ApiDescription("Name of the SDK, normalized for grouping")]


class EventMetadataResponse(TypedDict, total=False):
    """
    The keys that event types (`sentry.eventtypes`), the event manager and Relay write
    to event and issue metadata. It mirrors `EventMetadata` in
    static/app/types/event.tsx. SDKs can send more keys, which are passed through.
    """

    title: Annotated[str, ApiDescription("Title of default and issue platform events")]
    value: Annotated[str, ApiDescription("Exception value, or the subtitle of an issue")]
    type: Annotated[str, ApiDescription("Exception type of error events")]
    synthetic: Annotated[
        bool,
        ApiDescription(
            "Whether the SDK fabricated the exception to carry a stacktrace, so its type is "
            "a platform label rather than what went wrong"
        ),
    ]
    filename: Annotated[str, ApiDescription("File of the frame where the error happened")]
    function: Annotated[str, ApiDescription("Function of the frame where the error happened")]
    message: Annotated[str, ApiDescription("Message of default, security and feedback events")]
    uri: Annotated[str, ApiDescription("URI that a CSP report blocked")]
    directive: Annotated[str, ApiDescription("CSP directive that was violated")]
    origin: Annotated[str, ApiDescription("Host name of HPKP, Expect-CT and Expect-Staple reports")]
    name: Annotated[str, ApiDescription("Name of the person who sent user feedback")]
    contact_email: Annotated[str, ApiDescription("Email of the person who sent user feedback")]
    source: Annotated[str, ApiDescription("Where user feedback came from, such as a widget")]
    in_app_frame_mix: Annotated[
        str, ApiDescription("Whether the stacktrace has in-app frames, system frames or both")
    ]
    stripped_crash: Annotated[
        bool,
        ApiDescription(
            "Whether a crash report was dropped because the issue already stores the most allowed"
        ),
    ]
    sdk: Annotated[EventMetadataSdkResponse, ApiDescription("SDK of the issue's first event")]
    severity: Annotated[float, ApiDescription("Severity score of the issue's first event")]
    severity_reason: Annotated[str, ApiDescription("Why the severity score is what it is")]
    initial_priority: Annotated[int, ApiDescription("Priority the issue was created with")]

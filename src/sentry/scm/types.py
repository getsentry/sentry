from dataclasses import dataclass
from typing import Literal, TypedDict

from scm.types import (
    CheckRunAction,
    CheckRunEventData,
    CommentAction,
    CommentEventData,
    CommentType,
    ProviderName,
    PullRequestAction,
    PullRequestEventData,
)


class SubscriptionEvent(TypedDict):
    """
    A "SubscriptionEvent" is an event that was sent by a source control management (SCM)
    service-provider. This type wraps the event and appends special metadata to aid processing
    and monitoring.

    All service provider events must be validated as authentic prior to being transformed to this
    type.
    """

    received_at: int
    """The UTC timestamp (in seconds) the event was received by Sentry's servers."""

    type: ProviderName
    """
    The name of the service provider who sent the event. A stringy enum value of "github",
    "gitlab", etc. For more information see the "ProviderName" type definition.
    """

    event_type_hint: str | None
    """
    Source control management service providers may send headers which hint at the event's
    contents. This hint is optionally provided to the consuming process and may be used to ignore
    unwanted events without deserializing the event body itself.
    """

    event: str
    """
    The event sent by the service provider. Typically a JSON object. The exact format is
    determined by the "type" field.
    """

    extra: dict[str, str | None | bool | int | float]
    """
    An arbitrary mapping of key, value pairs extracted from the request headers of the message or
    the local Sentry environment. The type is provider specific and can be determined by
    investigating the target integrations webhook.py file.
    """

    sentry_meta: list["SubscriptionEventSentryMeta"] | None
    """
    If the event is opportunistically associated with internal Sentry metadata then that metadata
    is specified here. If this data is not present your process will need to derive it from the
    event.

    This is included with GitLab requests but not with GitHub requests. This is because it is
    necessary to derive this metadata to authenticate the request. GitHub requests do not need to
    query for this metadata to authenticate their requests. Querying for Sentry metadata is left
    as an exercise for the implementer if not provided.
    """


class SubscriptionEventSentryMeta(TypedDict):
    id: int | None
    """
    "OrganizationIntegration" model identifier. Optionally specified. Only specified if the
    installation has been explicitly queried.
    """

    integration_id: int | None
    """
    "Integration" model identifier.
    """

    organization_id: int | None
    """
    "Organization" model identifier.
    """


@dataclass(frozen=True)
class CheckRunEvent:
    action: CheckRunAction
    """The action that triggered the event. An enumeration of string values."""

    check_run: CheckRunEventData
    """"""

    subscription_event: SubscriptionEvent
    """
    The subscription event that was received by Sentry. This field contains the raw instructions
    which parsed the action and check_run fields. You can use this field to perform additional
    parsing if the default implementation is lacking.

    This field will also include any extra metadata that was generated prior to being submitted to
    the listener. In some cases, Sentry will query the database for information. This information
    is stored in the "sentry_meta" field and is accessible without performing redundant queries.
    """


@dataclass(frozen=True)
class CommentEvent:
    """ """

    action: CommentAction
    """The action that triggered the event. An enumeration of string values."""

    comment_type: CommentType
    """"""

    comment: CommentEventData
    """"""

    subscription_event: SubscriptionEvent
    """
    The subscription event that was received by Sentry. This field contains the raw instructions
    which parsed the action and comment fields. You can use this field to perform additional
    parsing if the default implementation is lacking.

    This field will also include any extra metadata that was generated prior to being submitted to
    the listener. In some cases, Sentry will query the database for information. This information
    is stored in the "sentry_meta" field and is accessible without performing redundant queries.
    """


@dataclass(frozen=True)
class PullRequestEvent:
    """
    Pull request event type. This event is received when an action was performed on a pull-request.
    For example, opened, closed, or ready for review.
    """

    action: PullRequestAction
    """The action that triggered the event. An enumeration of string values."""

    pull_request: PullRequestEventData
    """The pull-request that was acted upon."""

    subscription_event: SubscriptionEvent
    """
    The subscription event that was received by Sentry. This field contains the raw instructions
    which parsed the action and pull_request fields. You can use this field to perform additional
    parsing if the default implementation is lacking.

    This field will also include any extra metadata that was generated prior to being submitted to
    the listener. In some cases, Sentry will query the database for information. This information
    is stored in the "sentry_meta" field and is accessible without performing redundant queries.
    """


type EventType = CheckRunEvent | CommentEvent | PullRequestEvent
type EventTypeHint = Literal["check_run", "comment", "pull_request"]
type HybridCloudSilo = Literal["control", "region"]

from typing import TypedDict

from sentry.scm.types import ProviderName


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

    event: bytes
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

    integration_id: int
    """
    "Integration" model identifier.
    """

    organization_id: int
    """
    "Organization" model identifier.
    """

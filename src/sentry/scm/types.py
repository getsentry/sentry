from typing import Literal, Protocol, TypedDict

type ProviderName = Literal["bitbucket", "github", "github_enterprise", "gitlab"]
type ExternalId = str
type Reaction = Literal["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"]
type Referrer = Literal["emerge", "shared"]
type RepositoryId = int | tuple[ProviderName, ExternalId]


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


class Repository(TypedDict):
    integration_id: int
    name: str
    organization_id: int
    status: str


class Provider(Protocol):
    """
    Providers abstract over an integration. They map generic commands to service-provider specific
    commands and they map the results of those commands to generic result-types.

    Providers necessarily offer a larger API surface than what is available in an integration. Some
    methods may be duplicates in some providers. This is intentional. Providers capture programmer
    intent and translate it into a concrete interface. Therefore, providers provide a large range
    of behaviors which may or may not be explicitly defined on a service-provider.
    """

    def is_rate_limited(self, organization_id: int, referrer: Referrer) -> bool: ...

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None:
        """Create a reaction to an issue."""
        ...

    # Examples of how you might implement some of the permutations of issue reaction:

    # def create_comment_reaction(
    #     self, repository: Repository, comment_id: str, reaction: Reaction
    # ) -> None: ...

    # def create_pull_request_reaction(
    #     self, repository: Repository, pull_request_id: str, reaction: Reaction
    # ) -> None: ...

    # def create_pull_request_review_reaction(
    #     self, repository: Repository, review_id: str, reaction: Reaction
    # ) -> None: ...

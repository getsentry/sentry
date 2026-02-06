from typing import Any, Literal, Protocol, TypedDict

type ProviderName = Literal["bitbucket", "github", "github_enterprise", "gitlab"]
type ExternalId = str
# Normalized reaction identifiers shared across all SCM providers.
type Reaction = Literal["+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes"]
# Identifies the caller so providers can apply per-referrer rate-limit policies.
type Referrer = Literal["emerge", "shared"]
# A repository can be identified by its internal DB id or by a (provider, external_id) pair.
type RepositoryId = int | tuple[ProviderName, ExternalId]


class Author(TypedDict):
    """Normalized author identity returned by all SCM providers."""

    id: str
    username: str


class Comment(TypedDict):
    """Provider-agnostic representation of an issue or pull-request comment."""

    id: str
    body: str | None
    author: Author | None


class CommentActionResult(TypedDict):
    """Wraps a Comment with provider metadata and the original API response.

    ActionResult types pair a normalized domain object with the provider name
    and the raw API payload. This lets callers work with a stable interface
    while still having access to provider-specific fields when needed.
    """

    comment: Comment
    provider: ProviderName
    raw: dict[str, Any]


class IssueReaction(TypedDict):
    """Provider-agnostic representation of a reaction on an issue."""

    id: str
    content: Reaction
    author: Author | None


class PullRequestBranch(TypedDict):
    """A branch reference within a pull request (head or base)."""

    sha: str


class PullRequest(TypedDict):
    """Provider-agnostic representation of a pull request."""

    head: PullRequestBranch


class PullRequestActionResult(TypedDict):
    """Wraps a PullRequest with provider metadata and the original API response.

    ActionResult types pair a normalized domain object with the provider name
    and the raw API payload. This lets callers work with a stable interface
    while still having access to provider-specific fields when needed.
    """

    pull_request: PullRequest
    provider: ProviderName
    raw: dict[str, Any]


class Repository(TypedDict):
    """Identifies a repository within a Sentry integration."""

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

    def get_pull_request(
        self, repository: Repository, pull_request_id: str
    ) -> PullRequestActionResult: ...

    def get_issue_comments(
        self, repository: Repository, issue_id: str
    ) -> list[CommentActionResult]: ...

    def create_issue_comment(self, repository: Repository, issue_id: str, body: str) -> None: ...

    def delete_issue_comment(self, repository: Repository, comment_id: str) -> None: ...

    def get_pull_request_comments(
        self, repository: Repository, pull_request_id: str
    ) -> list[CommentActionResult]: ...

    def create_pull_request_comment(
        self, repository: Repository, pull_request_id: str, body: str
    ) -> None: ...

    def delete_pull_request_comment(self, repository: Repository, comment_id: str) -> None: ...

    def get_comment_reactions(
        self, repository: Repository, comment_id: str
    ) -> list[IssueReaction]: ...

    def create_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None: ...

    def delete_comment_reaction(
        self, repository: Repository, comment_id: str, reaction: Reaction
    ) -> None: ...

    def get_issue_reactions(self, repository: Repository, issue_id: str) -> list[IssueReaction]: ...

    def create_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None: ...

    def delete_issue_reaction(
        self, repository: Repository, issue_id: str, reaction: Reaction
    ) -> None: ...


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


type CheckRunAction = Literal["completed", "created", "requested_action", "rerequested"]


class CheckRunEventData(TypedDict):
    external_id: str
    html_url: str


class CheckRunEvent(TypedDict):
    action: CheckRunAction
    """The action that triggered the event. An enumeration of string values."""

    check_run: CheckRunEventData
    """"""

    subscription_event: SubscriptionEvent
    """
    The subscription event that was received by Sentry. This field contains the raw instructions
    which parsed the action and pull_request fields. You can use this field to perform additional
    parsing if the default implementation is lacking.

    This field will also include any extra metadata that was generated prior to being submitted to
    the listener. In some cases, Sentry will query the database for information. This information
    is stored in the "sentry_meta" field and is accessible without performing redundant queries.
    """


type CommentAction = Literal["created", "deleted", "edited", "pinned", "unpinned"]
type CommentType = Literal["issue", "pull_request"]


class CommentEventData(TypedDict):
    id: str
    body: str | None
    author: Author | None


class CommentEvent(TypedDict):
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
    which parsed the action and pull_request fields. You can use this field to perform additional
    parsing if the default implementation is lacking.

    This field will also include any extra metadata that was generated prior to being submitted to
    the listener. In some cases, Sentry will query the database for information. This information
    is stored in the "sentry_meta" field and is accessible without performing redundant queries.
    """


type PullRequestAction = Literal[
    "assigned",
    "closed",
    "edited",
    "labeled",
    "opened",
    "ready_for_review",
    "reopened",
    "review_request_removed",
    "review_requested",
]


class PullRequestEventData(TypedDict):
    id: str
    title: str
    description: str | None
    head: PullRequestBranch
    base: PullRequestBranch
    is_private_repo: bool
    author: Author | None


class PullRequestEvent(TypedDict):
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

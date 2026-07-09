from __future__ import annotations

import abc
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Literal, Protocol

from pydantic import BaseModel

from sentry.integrations.types import ExternalProviderEnum


class NotificationCategory(StrEnum):
    """
    The category of notification to be sent.
    These categories are the broad groupings that users can manage in their settings.
    The exception is the `DEBUG` category, which is used for testing and development.
    """

    # TODO(ecosystem): Connect this to NotificationSettingEnum
    DEBUG = "debug"
    DATA_EXPORT = "data-export"
    DYNAMIC_SAMPLING = "dynamic-sampling"
    REPOSITORY = "repository"
    SEER = "seer"
    ISSUE = "issue"
    METRIC_ALERT = "metric-alert"
    SENTRY_APP = "sentry-app"

    # Refers to net-new alerts built on the workflow engine (not metric/issue alerts)
    ALERTS = "alerts"

    def get_sources(self) -> list[NotificationSource]:
        return NOTIFICATION_SOURCE_MAP[self]


class NotificationSource(StrEnum):
    """
    A name for a notification being sent. Each notification sent should have a unique source.
    """

    # DEBUG
    TEST = "test"
    ERROR_ALERT = "error-alert-service"
    DEPLOYMENT = "deployment-service"
    SLOW_LOAD_METRIC_ALERT = "slow-load-metric-alert"
    PERFORMANCE_MONITORING = "performance-monitoring"
    TEAM_COMMUNICATION = "team-communication"

    # DATA_EXPORT
    DATA_EXPORT_SUCCESS = "data-export-success"
    DATA_EXPORT_FAILURE = "data-export-failure"

    # DYNAMIC_SAMPLING
    CUSTOM_RULE_SAMPLES_FULFILLED = "custom-rule-samples-fulfilled"

    # REPOSITORY
    UNABLE_TO_DELETE_REPOSITORY = "unable-to-delete-repository"

    # ISSUE_ALERT
    ISSUE = "issue"

    # METRIC_ALERT
    METRIC_ALERT = "metric-alert"

    # SEER
    SEER_AUTOFIX_ERROR = "seer-autofix-error"
    SEER_AUTOFIX_UPDATE = "seer-autofix-update"
    SEER_AUTOFIX_TRIGGER = "seer-autofix-trigger"
    SEER_AUTOFIX_FOOTER = "seer-autofix-footer"
    SEER_AUTOFIX_SUCCESS = "seer-autofix-success"
    SEER_AGENT_RESPONSE = "seer-agent-response"
    SEER_AGENT_ERROR = "seer-agent-error"

    # SENTRY_APP
    SENTRY_APP_WEBHOOK_DISABLED = "sentry-app-webhook-disabled"

    # WORKFLOW_ENGINE
    ACTIVITY_SEER_RCA_STARTED = "activity-seer-rca-started"
    ACTIVITY_SEER_RCA_COMPLETED = "activity-seer-rca-completed"
    ACTIVITY_SEER_SOLUTION_STARTED = "activity-seer-solution-started"
    ACTIVITY_SEER_SOLUTION_COMPLETED = "activity-seer-solution-completed"
    ACTIVITY_SEER_CODING_STARTED = "activity-seer-coding-started"
    ACTIVITY_SEER_CODING_COMPLETED = "activity-seer-coding-completed"
    ACTIVITY_SEER_PR_CREATED = "activity-seer-pr-created"
    ACTIVITY_SEER_ITERATION_STARTED = "activity-seer-iteration-started"
    ACTIVITY_SEER_ITERATION_COMPLETED = "activity-seer-iteration-completed"
    ACTIVITY_SET_RESOLVED = "activity-set-resolved"
    ACTIVITY_SET_RESOLVED_IN_RELEASE = "activity-set-resolved-in-release"
    ACTIVITY_SET_RESOLVED_BY_AGE = "activity-set-resolved-by-age"
    ACTIVITY_SET_RESOLVED_IN_COMMIT = "activity-set-resolved-in-commit"


NOTIFICATION_SOURCE_MAP: dict[NotificationCategory, list[NotificationSource]] = {
    NotificationCategory.DEBUG: [
        NotificationSource.TEST,
        NotificationSource.ERROR_ALERT,
        NotificationSource.DEPLOYMENT,
        NotificationSource.SLOW_LOAD_METRIC_ALERT,
        NotificationSource.PERFORMANCE_MONITORING,
        NotificationSource.TEAM_COMMUNICATION,
    ],
    NotificationCategory.DATA_EXPORT: [
        NotificationSource.DATA_EXPORT_SUCCESS,
        NotificationSource.DATA_EXPORT_FAILURE,
    ],
    NotificationCategory.DYNAMIC_SAMPLING: [
        NotificationSource.CUSTOM_RULE_SAMPLES_FULFILLED,
    ],
    NotificationCategory.REPOSITORY: [
        NotificationSource.UNABLE_TO_DELETE_REPOSITORY,
    ],
    NotificationCategory.ISSUE: [
        NotificationSource.ISSUE,
    ],
    NotificationCategory.METRIC_ALERT: [
        NotificationSource.METRIC_ALERT,
    ],
    NotificationCategory.SEER: [
        NotificationSource.SEER_AUTOFIX_TRIGGER,
        NotificationSource.SEER_AUTOFIX_ERROR,
        NotificationSource.SEER_AUTOFIX_SUCCESS,
        NotificationSource.SEER_AUTOFIX_UPDATE,
        NotificationSource.SEER_AGENT_RESPONSE,
        NotificationSource.SEER_AGENT_ERROR,
    ],
    NotificationCategory.SENTRY_APP: [
        NotificationSource.SENTRY_APP_WEBHOOK_DISABLED,
    ],
    NotificationCategory.ALERTS: [
        NotificationSource.ACTIVITY_SEER_RCA_STARTED,
        NotificationSource.ACTIVITY_SEER_RCA_COMPLETED,
        NotificationSource.ACTIVITY_SEER_SOLUTION_STARTED,
        NotificationSource.ACTIVITY_SEER_SOLUTION_COMPLETED,
        NotificationSource.ACTIVITY_SEER_CODING_STARTED,
        NotificationSource.ACTIVITY_SEER_CODING_COMPLETED,
        NotificationSource.ACTIVITY_SEER_PR_CREATED,
        NotificationSource.ACTIVITY_SEER_ITERATION_STARTED,
        NotificationSource.ACTIVITY_SEER_ITERATION_COMPLETED,
        NotificationSource.ACTIVITY_SET_RESOLVED,
        NotificationSource.ACTIVITY_SET_RESOLVED_IN_RELEASE,
        NotificationSource.ACTIVITY_SET_RESOLVED_BY_AGE,
        NotificationSource.ACTIVITY_SET_RESOLVED_IN_COMMIT,
    ],
}


class NotificationProviderKey(StrEnum):
    """
    The unique keys for each registered notification provider.
    """

    EMAIL = ExternalProviderEnum.EMAIL
    SLACK = ExternalProviderEnum.SLACK
    SLACK_STAGING = ExternalProviderEnum.SLACK_STAGING
    MSTEAMS = ExternalProviderEnum.MSTEAMS
    DISCORD = ExternalProviderEnum.DISCORD


class NotificationTargetResourceType(StrEnum):
    """
    Avenues for a notification to be sent to that can be understood by a provider.
    """

    EMAIL = "email"
    CHANNEL = "channel"
    DIRECT_MESSAGE = "direct_message"


class NotificationTarget(BaseModel):
    """
    All targets of the notification platform must adhere to this base class.
    """

    class Config:
        frozen = True
        use_enum_values = True

    provider_key: NotificationProviderKey
    resource_type: NotificationTargetResourceType
    resource_id: str
    specific_data: dict[str, Any] | None = None


class NotificationStrategy(Protocol):
    """
    A strategy for determining which targets to send a notification to.
    """

    def get_targets(self) -> list[NotificationTarget]: ...


class NotificationData(BaseModel):
    """
    All data passing through the notification platform must adhere to this base class.
    """

    class Config:
        frozen = True
        use_enum_values = True

    source: NotificationSource
    """
    The source is uniquely attributable to the way this notification was sent. It will be tracked in
    metrics/analytics to determine the egress from a given code-path or service.
    """


@dataclass(frozen=True)
class NotificationRenderedAction:
    """
    A rendered action for an integration.
    """

    label: str
    """
    The text content of the action (usually appears as a button).
    This string should not contain any formatting, and will be displayed as is.
    """
    link: str
    """
    The underlying link of the action.
    """


@dataclass(frozen=True)
class NotificationRenderedImage:
    """
    An image that will be displayed in the notification.
    """

    url: str
    """
    The URL of the image.
    """
    alt_text: str
    """
    The alt text of the image.
    """


@dataclass(frozen=True)
class NotificationRenderedTemplate:
    subject: str | list[NotificationTextBlock]
    """
    The subject or title of the notification. It's expected that the receiver understand the
    expected content of the notification based on this alone, and it will be the first thing
    they see.
    """

    @staticmethod
    def render_text_blocks(blocks: list[NotificationTextBlock]) -> str:
        text = []
        for block in blocks:
            if isinstance(block, LinkTextBlock):
                text.append(f"{block.text} ({block.url})")
            else:
                text.append(block.text)
        return " ".join(text)

    @property
    def subject_blocks(self) -> list[NotificationTextBlock]:
        if isinstance(self.subject, list):
            return self.subject
        return [PlainTextBlock(text=self.subject)]

    @property
    def subject_text(self) -> str:
        return self.render_text_blocks(self.subject_blocks)

    body: list[NotificationSection]
    """
    The full contents of the notification. Put the details of the notification here, but consider
    keeping it concise and useful to the receiver.
    """
    actions: list[NotificationRenderedAction] = field(default_factory=list)
    """
    The list of actions that a receiver may take after having received the notification.
    """
    chart: NotificationRenderedImage | None = None
    """
    The image that will be displayed in the notification.
    """
    footer: str | list[NotificationTextBlock] | None = None
    """
    Extra notification content that will appear after any actions, separate from the body. Optional,
    and consider omitting if the extra data is not necessary for your notification to be useful.
    """

    @property
    def footer_blocks(self) -> list[NotificationTextBlock]:
        if self.footer is None:
            return []
        if isinstance(self.footer, list):
            return self.footer
        return [PlainTextBlock(text=self.footer)]

    @property
    def footer_text(self) -> str:
        return self.render_text_blocks(self.footer_blocks)

    # The following are optional, as omitting them will use a default email template which expects
    # the required fields above to be present instead.
    email_html_path: str | None = None
    """
    The email HTML template file path. The associated NotificationData will be passed as context.
    In general, try to avoid including different information in these Django Templates than appear
    in the required fields, as it will make the contents of your notification vary from email to other
    providers.
    """
    email_text_path: str | None = None
    """
    The email text template file path. The associated NotificationData will be passed as context.
    In general, try to avoid including different information in these Django Templates than appear
    in the required fields, as it will make the contents of your notification vary from email to other
    providers.
    """


class NotificationTextBlockType(StrEnum):
    """
    Represents a block of text to be rendered in the notification.
    """

    PLAIN_TEXT = "plain_text"
    """
    A plain text block.
    """
    BOLD_TEXT = "bold_text"
    """
    A bolded section of text.
    """
    ITALIC_TEXT = "italic_text"
    """
    An italicized section of text.
    """
    CODE = "code"
    """
    Inline block of code.
    """
    LINK = "link"
    """
    A hyperlink with display text.
    """


class NotificationSectionType(StrEnum):
    """
    The type of formatting to be applied to the encapsulated blocks.
    """

    PARAGRAPH = "paragraph"
    """
    A block of text with a line break before.
    """
    CODE_BLOCK = "code_block"
    """
    A new section of code with a line break before.
    """
    BLOCK_QUOTE = "block_quote"
    """
    A quoted block of text, rendered as a blockquote.
    """


class NotificationSection(Protocol):
    """
    A section of text that applies formatting such as a newline and encapsulates other text.
    """

    type: NotificationSectionType
    """
    The type of the section, such as ParagraphSection, CodeSection, etc.
    """
    blocks: list[NotificationTextBlock]
    """
    The text blocks contain actual content, such as BoldTextBlock, ItalicTextBlock, etc.
    """


class NotificationTextBlock(Protocol):
    """
    Represents a block of text to be rendered in the notification.
    """

    type: NotificationTextBlockType
    """
    The type of the block, such as BoldTextBlock, CodeTextBlock, etc.
    """
    text: str
    """
    Text to be rendered in the notification.
    """


@dataclass
class ParagraphSection(NotificationSection):
    blocks: list[NotificationTextBlock]
    type: Literal[NotificationSectionType.PARAGRAPH] = NotificationSectionType.PARAGRAPH


@dataclass
class CodeSection(NotificationSection):
    blocks: list[NotificationTextBlock]
    type: Literal[NotificationSectionType.CODE_BLOCK] = NotificationSectionType.CODE_BLOCK


@dataclass
class BlockQuoteSection(NotificationSection):
    blocks: list[NotificationTextBlock]
    type: Literal[NotificationSectionType.BLOCK_QUOTE] = NotificationSectionType.BLOCK_QUOTE


@dataclass
class BoldTextBlock(NotificationTextBlock):
    text: str
    type: Literal[NotificationTextBlockType.BOLD_TEXT] = NotificationTextBlockType.BOLD_TEXT


@dataclass
class ItalicTextBlock(NotificationTextBlock):
    text: str
    type: Literal[NotificationTextBlockType.ITALIC_TEXT] = NotificationTextBlockType.ITALIC_TEXT


@dataclass
class CodeTextBlock(NotificationTextBlock):
    text: str
    type: Literal[NotificationTextBlockType.CODE] = NotificationTextBlockType.CODE


@dataclass
class PlainTextBlock(NotificationTextBlock):
    text: str
    type: Literal[NotificationTextBlockType.PLAIN_TEXT] = NotificationTextBlockType.PLAIN_TEXT


@dataclass
class LinkTextBlock(NotificationTextBlock):
    text: str
    url: str
    type: Literal[NotificationTextBlockType.LINK] = NotificationTextBlockType.LINK


class NotificationTemplate[T: NotificationData](abc.ABC):
    category: NotificationCategory
    """
    The category that a notification belongs to. This will be used to determine which settings a
    user needs to modify to manage receipt of these notifications (if applicable).
    """
    example_data: T
    """
    The example data for this notification.
    """
    hide_from_debugger: bool = False
    """
    Set 'true' to omit these templates from the internal debugger (sentry.io/debug/notifications).
    This is useful for templates that only use custom renderers and bypass NotificationRenderedTemplates.
    """

    @abc.abstractmethod
    def render(self, data: T) -> NotificationRenderedTemplate:
        """
        Produce a rendered template given the notification data. Usually, this will involve
        formatting the data into user-friendly strings of text.
        """
        ...

    def render_example(self) -> NotificationRenderedTemplate:
        """
        Used to produce a debugging example rendered template for this notification. This
        implementation should be pure, and not populate with any live data.
        """
        return self.render(data=self.example_data)

    @classmethod
    def get_data_class(cls) -> type[NotificationData]:
        """
        Returns NotificationData type for this template.
        """
        return cls.example_data.__class__

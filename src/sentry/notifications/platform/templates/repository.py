from dataclasses import dataclass

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.types import NotificationTemplateSource
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedTemplate,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)


@dataclass(frozen=True)
class UnableToDeleteRepository(NotificationData):
    source = NotificationTemplateSource.UNABLE_TO_DELETE_REPOSITORY
    repository_name: str
    provider_name: str
    error_message: str


@template_registry.register(UnableToDeleteRepository.source)
class UnableToDeleteRepositoryTemplate(NotificationTemplate[UnableToDeleteRepository]):
    category = NotificationCategory.REPOSITORY
    example_data = UnableToDeleteRepository(
        repository_name="getsentry/sentry",
        provider_name="GitHub",
        error_message="An internal server error occurred",
    )

    def render(self, data: UnableToDeleteRepository) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Unable to Delete Repository Webhooks",
            body=[
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text=f"We were unable to delete webhooks in {data.provider_name} for your repository "
                        ),
                        CodeTextBlock(text=data.repository_name),
                        PlainTextBlock(text=" due to the following error:"),
                    ]
                ),
                ParagraphBlock(blocks=[CodeTextBlock(text=data.error_message)]),
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text=f"You will need to remove these webhooks manually in {data.provider_name} in order to stop sending commit data to Sentry."
                        )
                    ]
                ),
            ],
        )

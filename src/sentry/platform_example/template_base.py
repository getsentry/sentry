from abc import ABC
from dataclasses import asdict, dataclass
from enum import StrEnum
from typing import Any, Generic, TypeVar

import jinja2

from sentry.platform_example.notification_types import NotificationType
from sentry.web.helpers import render_to_string

env = jinja2.Environment()


@dataclass
class TemplateData:
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


NotificationTemplateDataT = TypeVar(
    "NotificationTemplateDataT",
    bound=TemplateData,
)


class TemplateType(StrEnum):
    django = "django"
    jinja = "jinja"


@dataclass
class NotificationChart:
    chart_id: str
    chart_type: str


@dataclass
class Template(ABC):
    body_template_path: str
    subject_template_path: str


@dataclass
class EmailTemplate(Template):
    body_plaintext_template_path: str | None = None


@dataclass
class IntegrationTemplate(Template):
    chart: NotificationChart | None = None
    help_text_template: str | None = None


@dataclass
class RenderedEmailTemplate:
    body: str
    subject: str


@dataclass
class RenderedIntegrationTemplate:
    subject: str
    body: str
    chart: NotificationChart | None = None
    help_text: str | None = None


@dataclass(frozen=True)
class NotificationTemplate(ABC, Generic[NotificationTemplateDataT]):
    email_template: EmailTemplate
    integration_template: IntegrationTemplate
    notification_type: NotificationType

    def render_email_template(self, data: NotificationTemplateDataT) -> RenderedEmailTemplate:
        raise NotImplementedError("Subclasses must implement this method")

    def render_integration_template(
        self, data: NotificationTemplateDataT
    ) -> RenderedIntegrationTemplate:
        raise NotImplementedError("Subclasses must implement this method")

    def get_title_link(self) -> str:
        raise NotImplementedError("Subclasses must implement this method")


@dataclass(frozen=True)
class JinjaNotificationTemplate(NotificationTemplate[NotificationTemplateDataT]):
    def render_email_template(self, data: NotificationTemplateDataT) -> RenderedEmailTemplate:
        return RenderedEmailTemplate(
            body=env.get_template(self.email_template.body_template_path).render(data),
            subject=env.get_template(self.email_template.subject_template_path).render(data),
        )

    def render_integration_template(
        self, data: NotificationTemplateDataT
    ) -> RenderedIntegrationTemplate:
        return RenderedIntegrationTemplate(
            body=env.get_template(self.integration_template.body_template_path).render(data),
            subject=env.get_template(self.integration_template.subject_template_path).render(data),
            chart=self.integration_template.chart,
            help_text=self.integration_template.help_text_template(data),
        )


@dataclass(frozen=True)
class DjangoNotificationTemplate(NotificationTemplate[NotificationTemplateDataT]):
    def render_email_template(self, data: NotificationTemplateDataT) -> RenderedEmailTemplate:
        return RenderedEmailTemplate(
            body=render_to_string(self.email_template.body_template_path, data.to_dict()),
            subject=render_to_string(self.email_template.subject_template_path, data.to_dict()),
        )

    def render_integration_template(
        self, data: NotificationTemplateDataT
    ) -> RenderedIntegrationTemplate:
        return RenderedIntegrationTemplate(
            body=render_to_string(self.integration_template.body_template_path, data.to_dict()),
            subject=render_to_string(
                self.integration_template.subject_template_path, data.to_dict()
            ),
            chart=self.integration_template.chart,
        )

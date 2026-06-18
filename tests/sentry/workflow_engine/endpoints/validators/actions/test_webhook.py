from rest_framework.exceptions import ErrorDetail

from sentry.models.options.project_option import ProjectOption
from sentry.plugins.base import plugins
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action
from sentry_plugins.trello.plugin import TrelloPlugin


class TestWebhookActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://example.com")

        # non notification plugin
        self.trello_plugin = plugins.get(TrelloPlugin.slug)
        self.trello_plugin.enable(self.project)

        self.alertable_sentry_app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application 1",
            is_alertable=True,
        )
        self.create_sentry_app_installation(
            slug=self.alertable_sentry_app.slug, organization=self.organization
        )

        self.non_alertable_sentry_app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application 2",
            is_alertable=False,
        )
        self.create_sentry_app_installation(
            slug=self.non_alertable_sentry_app.slug, organization=self.organization
        )

        self.valid_data = {
            "type": Action.Type.WEBHOOK,
            "config": {"targetIdentifier": self.alertable_sentry_app.slug},
            "data": {},
        }

    def test_validate__sentry_app(self) -> None:
        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True
        validator.save()

    def test_validate__invalid_sentry_app(self) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"targetIdentifier": self.non_alertable_sentry_app.slug},
            },
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "service": [
                ErrorDetail(
                    string=f"Select a valid choice. {self.non_alertable_sentry_app.slug} is not one of the available choices.",
                    code="invalid",
                )
            ]
        }

    def test_validate__plugin(self) -> None:
        validator = BaseActionValidator(
            data={**self.valid_data, "config": {"targetIdentifier": "webhooks"}},
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True
        validator.save()

    def test_validate__invalid_plugin(self) -> None:
        validator = BaseActionValidator(
            data={**self.valid_data, "config": {"targetIdentifier": self.trello_plugin.slug}},
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "service": [
                ErrorDetail(
                    string=f"Select a valid choice. {self.trello_plugin.slug} is not one of the available choices.",
                    code="invalid",
                )
            ]
        }

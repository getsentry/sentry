from unittest import mock

from rest_framework.serializers import ErrorDetail

from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult
from sentry.sentry_apps.utils.errors import SentryAppErrorType
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowEventData


class TestSentryAppActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.valid_data = {
            "type": Action.Type.SENTRY_APP,
            "config": {
                "sentry_app_identifier": "sentry_app_installation_uuid",
                "targetType": "sentry_app",
                "target_identifier": "123",
            },
            "data": {"settings": []},
        }

        group_event = self.event.for_group(self.group)

        self.event_data = WorkflowEventData(
            event=group_event,
            group=self.group,
        )
        self.rule = self.create_project_rule(project=self.project)
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow()
        self.create_alert_rule_workflow(rule_id=self.rule.id, workflow_id=self.workflow.id)

    @mock.patch(
        "sentry.rules.actions.sentry_apps.utils.app_service.trigger_sentry_app_action_creators"
    )
    def test_validate(self, mock_trigger_sentry_app_action_creators: mock.MagicMock) -> None:
        mock_trigger_sentry_app_action_creators.return_value = RpcAlertRuleActionResult(
            success=True, message="success"
        )

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True
        validator.save()

    @mock.patch(
        "sentry.rules.actions.sentry_apps.utils.app_service.trigger_sentry_app_action_creators"
    )
    def test_validate__rpc_failure(
        self, mock_trigger_sentry_app_action_creators: mock.MagicMock
    ) -> None:
        mock_trigger_sentry_app_action_creators.return_value = RpcAlertRuleActionResult(
            success=False,
            message="Could not create sentry app action",
            error_type=SentryAppErrorType.SENTRY,
        )

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is False
        assert validator.errors == {
            "nonFieldErrors": [
                ErrorDetail(
                    string="Something went wrong during the alert rule action process!",
                    code="invalid",
                )
            ]
        }

    @mock.patch(
        "sentry.rules.actions.sentry_apps.utils.app_service.trigger_sentry_app_action_creators"
    )
    def test_validate_settings_action_trigger(
        self, mock_trigger_sentry_app_action_creators: mock.MagicMock
    ) -> None:
        self.create_sentry_app(
            organization=self.organization,
            name="Test Application",
            is_alertable=True,
        )
        install = self.create_sentry_app_installation(
            slug="test-application", organization=self.organization
        )
        self.valid_data = {
            "type": Action.Type.SENTRY_APP,
            "config": {
                "sentry_app_identifier": "sentry_app_installation_uuid",
                "targetType": "sentry_app",
                "target_identifier": install.uuid,
            },
            "data": {
                "settings": [
                    {
                        "name": "asdf",
                        "label": None,
                        "value": [{"id": "1dedabd2-059d-457b-ac17-df39031d4593", "type": "team"}],
                    },
                    {
                        "name": "fdsa",
                        "label": "label",
                        "value": "string",
                    },
                ]
            },
        }
        mock_trigger_sentry_app_action_creators.return_value = RpcAlertRuleActionResult(
            success=True, message="success"
        )

        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )

        result = validator.is_valid()
        assert result is True
        action = validator.save()

        setattr(action, "workflow_id", self.workflow.id)
        action.trigger(self.event_data)  # action should be triggerable

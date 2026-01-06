import uuid
from unittest import mock

from rest_framework.serializers import ErrorDetail

from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult
from sentry.sentry_apps.utils.errors import SentryAppErrorType
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.typings.notification_action import ActionType, SentryAppIdentifier
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestSentryAppActionValidator(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()

        self.sentry_app, self.sentry_app_installation = self.create_sentry_app_with_schema()
        self.sentry_app_settings = [
            {"name": "alert_prefix", "value": "[Not Good]"},
            {"name": "channel", "value": "#ignored-errors"},
            {"name": "best_emoji", "value": ":fire:"},
            {"name": "teamId", "value": "1"},
            {"name": "assigneeId", "value": "3"},
        ]
        self.valid_data = {
            "type": Action.Type.SENTRY_APP,
            "config": {
                "sentryAppIdentifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
                "targetType": ActionType.SENTRY_APP,
                "targetIdentifier": self.sentry_app_installation.uuid,
            },
            "data": {"settings": self.sentry_app_settings},
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
    def test_validate_sentry_app_id(
        self, mock_trigger_sentry_app_action_creators: mock.MagicMock
    ) -> None:
        mock_trigger_sentry_app_action_creators.return_value = RpcAlertRuleActionResult(
            success=True, message="success"
        )
        valid_data = {
            "type": Action.Type.SENTRY_APP,
            "config": {
                "sentryAppIdentifier": SentryAppIdentifier.SENTRY_APP_ID,
                "targetType": ActionType.SENTRY_APP,
                "targetIdentifier": str(self.sentry_app.id),
            },
            "data": {"settings": self.sentry_app_settings},
        }

        validator = BaseActionValidator(
            data=valid_data,
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
                "sentry_app_identifier": SentryAppIdentifier.SENTRY_APP_INSTALLATION_UUID,
                "targetType": ActionType.SENTRY_APP,
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
        action.trigger(
            self.event_data, notification_uuid=str(uuid.uuid4())
        )  # action should be triggerable

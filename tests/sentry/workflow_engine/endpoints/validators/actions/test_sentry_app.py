import uuid
from unittest import mock

from rest_framework.serializers import ErrorDetail

from sentry.sentry_apps.services.app.model import RpcAlertRuleActionResult
from sentry.sentry_apps.utils.errors import SentryAppErrorType
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.typings.notification_action import ActionType
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
                "targetType": ActionType.SENTRY_APP,
                "targetIdentifier": str(self.sentry_app.id),
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
    def test_optional_settings_use_app_validation(self, trigger: mock.MagicMock) -> None:
        component = self.create_alert_rule_action_schema()
        del component["settings"]["required_fields"]
        app = self.create_sentry_app(
            organization=self.organization, schema={"elements": [component]}, is_alertable=True
        )
        install = self.create_sentry_app_installation(slug=app.slug, organization=self.organization)
        config = {"targetType": ActionType.SENTRY_APP, "targetIdentifier": str(app.id)}
        trigger.return_value = RpcAlertRuleActionResult(success=True, message="success")
        action = None
        overrides: list[list[dict[str, str]] | None] = [
            None,
            [{"name": "points", "value": "3"}],
            [],
        ]
        for settings in overrides:
            data = {} if settings is None else {"settings": settings}
            validator = BaseActionValidator(
                instance=action,
                data={"type": Action.Type.SENTRY_APP, "config": config, "data": data},
                context={"organization": self.organization},
            )
            assert validator.is_valid(), validator.errors
            action = validator.save()
            expected = settings or []
            assert action.data == {"settings": expected}
            trigger.assert_called_once_with(install_uuid=install.uuid, fields=expected)
            trigger.reset_mock()

        trigger.return_value = RpcAlertRuleActionResult(
            success=False, message="Rejected", error_type=SentryAppErrorType.SENTRY
        )
        validator = BaseActionValidator(
            data={"type": Action.Type.SENTRY_APP, "config": config, "data": {}},
            context={"organization": self.organization},
        )
        assert not validator.is_valid()
        assert "nonFieldErrors" in validator.errors

    def test_validate_rejects_non_list_settings(self) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "data": {"settings": {"channel": "#ignored-errors"}},
            },
            context={"organization": self.organization},
        )

        assert not validator.is_valid()
        assert "data" in validator.errors

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
        sentry_app = self.create_sentry_app(
            organization=self.organization,
            name="Test Application",
            is_alertable=True,
        )
        self.create_sentry_app_installation(slug=sentry_app.slug, organization=self.organization)
        self.valid_data = {
            "type": Action.Type.SENTRY_APP,
            "config": {
                "targetType": ActionType.SENTRY_APP,
                "target_identifier": str(sentry_app.id),
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

        action.trigger(
            self.event_data,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )  # action should be triggerable

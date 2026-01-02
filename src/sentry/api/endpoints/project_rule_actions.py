import logging

import sentry_sdk
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers.rest_framework import DummyRuleSerializer
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.rule import Rule
from sentry.notifications.notification_action.utils import should_fire_workflow_actions
from sentry.notifications.types import TEST_NOTIFICATION_ID
from sentry.rules.processing.processor import activate_downstream_actions
from sentry.services.eventstore.models import GroupEvent
from sentry.shared_integrations.exceptions import (
    IntegrationConfigurationError,
    IntegrationFormError,
)
from sentry.utils.samples import create_sample_event
from sentry.workflow_engine.endpoints.utils.test_fire_action import test_fire_action
from sentry.workflow_engine.migration_helpers.rule_action import (
    translate_rule_data_actions_to_notification_actions,
)
from sentry.workflow_engine.models import Workflow
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)

REPORTABLE_ERROR_TYPES = (IntegrationFormError, IntegrationConfigurationError)


@region_silo_endpoint
class ProjectRuleActionsEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    permission_classes = (ProjectAlertRulePermission,)

    def post(self, request: Request, project) -> Response:
        """
        Creates a dummy event/group and activates the actions given by request body

            {method} {path}
            {{
                "actions": []
                "name": string
            }}

        """
        serializer = DummyRuleSerializer(
            context={"project": project, "organization": project.organization}, data=request.data
        )

        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        data = serializer.validated_data
        if len(data.get("actions", [])) == 0:
            raise ValidationError("No actions to perform.")

        for action in data.get("actions"):
            action["skipDigests"] = True
        data.update(
            {
                "conditions": [],
                "filters": [],
                "actionMatch": "all",
                "filterMatch": "all",
                "frequency": 30,
            }
        )
        rule = Rule(id=TEST_NOTIFICATION_ID, project=project, data=data, label=data.get("name"))

        # Cast to GroupEvent rather than Event to match expected types
        test_event = create_sample_event(
            project, platform=project.platform, default="javascript", tagged=True
        )

        group_event = GroupEvent.from_event(
            event=test_event,
            group=test_event.group,
        )

        if should_fire_workflow_actions(project.organization, ErrorGroupType.type_id):
            return self.execute_future_on_test_event_workflow_engine(group_event, rule)
        else:
            return self.execute_future_on_test_event(group_event, rule)

    def execute_future_on_test_event(
        self,
        test_event: GroupEvent,
        rule: Rule,
    ) -> Response:
        """
        A slightly modified version of utils.safe.safe_execute that handles
        IntegrationFormErrors, and returns a body with `{ actions: [<error info>] }`.

        This is used in our Alert Rule UI to display errors to the user.
        """
        action_exceptions = []
        for callback, futures in activate_downstream_actions(rule, test_event).values():
            try:
                callback(test_event, futures)
            except Exception as exc:
                callback_name = getattr(callback, "__name__", str(callback))
                cls_name = callback.__class__.__name__
                logger = logging.getLogger(f"sentry.test_rule.{cls_name.lower()}")

                # safe_execute logs these as exceptions, which can result in
                # noisy sentry issues, so log with a warning instead.
                if isinstance(exc, REPORTABLE_ERROR_TYPES):
                    logger.warning(
                        "%s.test_alert.integration_error", callback_name, extra={"exc": exc}
                    )

                    # IntegrationFormErrors should be safe to propagate via the API
                    action_exceptions.append(str(exc))
                else:
                    # If we encounter some unexpected exception, we probably
                    # don't want to continue executing more callbacks.
                    logger.warning(
                        "%s.test_alert.unexpected_exception", callback_name, exc_info=True
                    )
                    error_id = sentry_sdk.capture_exception(exc)
                    action_exceptions.append(
                        f"An unexpected error occurred. Error ID: '{error_id}'"
                    )

                break

        status = None
        data = None
        # Presence of "actions" here means we have exceptions to surface to the user
        if len(action_exceptions) > 0:
            status = 400
            data = {"actions": action_exceptions}

        return Response(status=status, data=data)

    def execute_future_on_test_event_workflow_engine(
        self,
        test_event: GroupEvent,
        rule: Rule,
    ) -> Response:
        """
        Invoke the workflow_engine to send a test notification.
        This method will lookup the corresponding workflow for a given rule then invoke the notification action.
        """
        action_exceptions = []
        actions = rule.data.get("actions", [])

        workflow = Workflow(
            id=TEST_NOTIFICATION_ID,
            name="Test Workflow",
            organization=rule.project.organization,
        )

        event_data = WorkflowEventData(
            event=test_event,
            group=test_event.group,
        )

        for action_blob in actions:
            try:
                action = translate_rule_data_actions_to_notification_actions(
                    [action_blob], skip_failures=False
                )[0]
                action.id = TEST_NOTIFICATION_ID
                # Annotate the action with the workflow id
                setattr(action, "workflow_id", workflow.id)
            except REPORTABLE_ERROR_TYPES as e:
                action_exceptions.append(str(e))
                continue
            except Exception as e:
                error_id = sentry_sdk.capture_exception(e)
                action_exceptions.append(f"An unexpected error occurred. Error ID: '{error_id}'")
                continue

            action_exceptions.extend(test_fire_action(action, event_data))

        status = None
        data = None
        if len(action_exceptions) > 0:
            status = 400
            data = {"actions": action_exceptions}

        return Response(status=status, data=data)

import logging

from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers.rest_framework import RuleActionSerializer
from sentry.eventstore.models import GroupEvent
from sentry.models.rule import Rule
from sentry.rules.processing.processor import activate_downstream_actions
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.safe import safe_execute
from sentry.utils.samples import create_sample_event


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
            }}

        """
        serializer = RuleActionSerializer(
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
        rule = Rule(id=-1, project=project, data=data)

        test_event = create_sample_event(
            project, platform=project.platform, default="javascript", tagged=True
        )

        if features.has(
            "projects:verbose-test-alert-reporting", project=project, actor=request.user
        ):
            return self.execute_future_on_test_event(test_event, rule)
        else:
            # Old existing behavior to wrap this in a handler which buries exceptions
            for callback, futures in activate_downstream_actions(rule, test_event).values():
                safe_execute(callback, test_event, futures)
            return Response()

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
                if isinstance(exc, IntegrationError):
                    logger.warning(
                        "%s.test_alert.integration_error", callback_name, extra={"exc": exc}
                    )

                    # IntegrationFormErrors should be safe to propagate via the API
                    action_exceptions.append(str(exc))
                else:
                    # If we encounter some unexpected exception, we probably
                    # don't want to continue executing more callbacks.
                    logger.warning(
                        "%s.test_alert.unexpected_exception", callback_name, extra={"exc": exc}
                    )
                    break

        status = None
        data = None
        # Presence of "actions" here means we have exceptions to surface to the user
        if len(action_exceptions) > 0:
            status = 400
            data = {"actions": action_exceptions}

        return Response(status=status, data=data)

from datetime import timedelta
from typing import Any

from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import cell_silo_test
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.endpoints.organization_workflow_preview import FEATURE_FLAG
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition


@cell_silo_test
class OrganizationWorkflowPreviewTest(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-preview"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def _payload(self, condition_type: Condition = Condition.FIRST_SEEN_EVENT) -> dict[str, Any]:
        return {
            "projectIds": [self.project.id],
            "config": {"frequency": 30},
            "triggers": {
                "logicType": DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
                "conditions": [
                    {
                        "type": condition_type,
                        "comparison": True,
                    }
                ],
            },
            "actionFilters": [
                {
                    "logicType": DataConditionGroup.Type.ALL,
                    "conditions": [],
                }
            ],
        }

    def test_returns_results_for_each_action_filter(self) -> None:
        end = timezone.now()
        group = self.create_group(
            project=self.project,
            first_seen=end - timedelta(hours=1),
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_success_response(self.organization.slug, **self._payload())

        assert response.data == [
            {
                "results": [
                    {
                        "groupId": str(group.id),
                        "triggeredAt": group.first_seen,
                        "isThrottled": False,
                    }
                ]
            }
        ]

    def test_rejects_unsupported_preview_behavior(self) -> None:
        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                status_code=400,
                **self._payload(Condition.EVERY_EVENT),
            )

        assert response.data == {"detail": "This alert configuration cannot be previewed."}

    def test_rejects_action_filter_as_trigger(self) -> None:
        payload = self._payload()
        payload["triggers"]["conditions"][0].update(
            {
                "type": Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
                "comparison": PriorityLevel.HIGH,
            }
        )

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                status_code=400,
                **payload,
            )

        assert response.data == {
            "detail": "issue_priority_greater_or_equal is not a workflow trigger condition"
        }

    def test_rejects_workflow_trigger_as_action_filter(self) -> None:
        payload = self._payload()
        payload["actionFilters"][0]["conditions"] = payload["triggers"]["conditions"]

        with self.feature(FEATURE_FLAG):
            response = self.get_error_response(
                self.organization.slug,
                status_code=400,
                **payload,
            )

        assert response.data == {"detail": "first_seen_event is not an action filter condition"}

    def test_requires_feature(self) -> None:
        self.get_error_response(
            self.organization.slug,
            status_code=404,
            **self._payload(),
        )

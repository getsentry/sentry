from datetime import timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import orjson
from slack_sdk.errors import SlackApiError
from slack_sdk.web import SlackResponse

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.integrations.slack.message_builder.routing import encode_action_id
from sentry.integrations.slack.message_builder.types import SlackAction
from sentry.investigations.models import Investigation
from sentry.models.group import Group
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.seer.entrypoints.cache import SeerOperatorInvestigationCache
from sentry.seer.entrypoints.slack.entrypoint import (
    SlackInvestigationCachePayload,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel

from . import BaseEventTest

FEATURES = ["organizations:investigations", "organizations:investigations-slack"]
CHANNEL_ID = "C065W1189"
MESSAGE_TS = "1702424381.221719"
STATUS_MESSAGE_TS = "1702424399.000100"


def _slack_response(data: dict[str, Any]) -> SlackResponse:
    return SlackResponse(
        client=None,
        http_verb="POST",
        api_url="https://slack.com/api/",
        req_args={},
        data=data,
        headers={},
        status_code=200,
    )


class SeerInvestigationStartActionTest(BaseEventTest):
    def setUp(self) -> None:
        super().setUp()
        self.metric_group, self.open_period = self.create_metric_open_period()
        self.mock_update = self.enterContext(
            patch(
                "slack_sdk.web.client.WebClient.chat_update",
                return_value=_slack_response({"ok": True}),
            )
        )
        self.mock_post_message = self.enterContext(
            patch(
                "slack_sdk.web.client.WebClient.chat_postMessage",
                return_value=_slack_response({"ok": True, "ts": STATUS_MESSAGE_TS}),
            )
        )
        self.mock_post_ephemeral = self.enterContext(
            patch(
                "slack_sdk.web.client.WebClient.chat_postEphemeral",
                return_value=_slack_response({"ok": True}),
            )
        )

    def create_metric_open_period(self) -> tuple[Group, GroupOpenPeriod]:
        group = self.create_group(
            project=self.project, type=MetricIssue.type_id, message="Checkout error spike"
        )
        open_period = GroupOpenPeriod.objects.get(group=group, date_ended__isnull=True)
        query = create_snuba_query(
            query_type=SnubaQuery.Type.ERROR,
            dataset=Dataset.Events,
            query="is:unresolved",
            aggregate="count()",
            time_window=timedelta(minutes=5),
            resolution=timedelta(minutes=1),
            environment=None,
        )
        subscription = create_snuba_subscription(
            project=self.project, subscription_type="incidents", snuba_query=query
        )
        data_source = self.create_data_source(
            organization=self.organization,
            source_id=str(subscription.id),
            type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        condition_group = self.create_data_condition_group(organization=self.organization)
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            config={"detection_type": "static", "comparison_delta": None},
            workflow_condition_group=condition_group,
            name="Checkout errors",
        )
        self.create_data_source_detector(data_source=data_source, detector=detector)
        self.create_detector_group(detector=detector, group=group)
        return group, open_period

    def get_action(self, group_id: int | None = None) -> dict[str, Any]:
        return {
            "action_id": encode_action_id(
                action=SlackAction.SEER_INVESTIGATION_START,
                organization_id=self.organization.id,
                project_id=self.project.id,
            ),
            "block_id": "investigation",
            "text": {"type": "plain_text", "text": "Investigate with Seer", "emoji": True},
            "value": orjson.dumps(
                {
                    "groupId": group_id or self.metric_group.id,
                    "openPeriodId": self.open_period.id,
                }
            ).decode(),
            "type": "button",
            "action_ts": "1458170917.164398",
        }

    def get_original_message(self) -> dict[str, Any]:
        return {
            "ts": MESSAGE_TS,
            "text": "Critical: Checkout errors",
            "attachments": [
                {
                    "id": 1,
                    "color": "E03E2F",
                    "fallback": "Critical: Checkout errors",
                    "blocks": [
                        {"type": "section", "text": {"type": "mrkdwn", "text": "123 events"}},
                        {"type": "actions", "elements": [self.get_action()]},
                    ],
                }
            ],
        }

    def click(
        self, *, slack_user: dict[str, Any] | None = None, group_id: int | None = None
    ) -> Any:
        return self.post_webhook_block_kit(
            action_data=[self.get_action(group_id)],
            original_message=self.get_original_message(),
            slack_user=slack_user,
        )

    def investigations(self) -> list[Investigation]:
        return list(Investigation.objects.filter(organization=self.organization))

    def test_unlinked_user_gets_link_prompt(self) -> None:
        response = self.click(slack_user={"id": "slack:unlinked", "team_id": "TXXXXXXX1"})

        assert response.status_code == 200
        assert "Link your identity now" in response.data["text"]
        assert response.data["response_type"] == "ephemeral"
        assert self.investigations() == []

    @with_feature(FEATURES)
    def test_non_member_is_blocked(self) -> None:
        non_member = self.create_user()
        self.create_identity(non_member, self.idp, "slack:2")

        response = self.click(slack_user={"id": "slack:2", "team_id": "TXXXXXXX1"})

        assert response.data["response_type"] == "ephemeral"
        assert response.data["text"] == (
            f"You must be a member of the *{self.organization.name}* Sentry organization "
            "to start a Seer investigation."
        )
        assert self.investigations() == []

    def test_flags_off_is_unavailable(self) -> None:
        response = self.click()

        assert response.data["text"] == "Seer can't start an investigation for this alert."
        assert self.investigations() == []

    @with_feature("organizations:investigations")
    def test_slack_flag_off_is_unavailable(self) -> None:
        response = self.click()

        assert response.data["text"] == "Seer can't start an investigation for this alert."
        assert self.investigations() == []

    @with_feature("organizations:investigations-slack")
    def test_investigations_flag_off_is_unavailable(self) -> None:
        response = self.click()

        assert response.data["text"] == "Seer can't start an investigation for this alert."
        assert self.investigations() == []

    @with_feature(FEATURES)
    def test_closed_membership_organization_is_unavailable(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        response = self.click()

        assert response.data["text"] == "Seer can't start an investigation for this alert."
        assert self.investigations() == []

    @with_feature(FEATURES)
    def test_group_from_another_organization_is_unavailable(self) -> None:
        other_project = self.create_project(organization=self.create_organization())
        other_group = self.create_group(project=other_project, type=MetricIssue.type_id)

        response = self.click(group_id=other_group.id)

        assert response.data["text"] == "Seer can't start an investigation for this alert."
        assert not Investigation.objects.exists()

    @with_feature(FEATURES)
    @patch("sentry.investigations.telemetry.sentry_sdk.metrics.count")
    def test_creates_investigation(self, mock_count: MagicMock) -> None:
        response = self.click()

        assert response.status_code == 200
        (investigation,) = self.investigations()
        assert investigation.created_by_id == self.user.id
        assert investigation.source["ref"] == {
            "groupId": str(self.metric_group.id),
            "openPeriodId": str(self.open_period.id),
        }
        mock_count.assert_any_call(
            "investigations.started",
            1,
            attributes={"source_type": "metric_open_period", "template": "manual"},
        )

        link = investigation.get_absolute_url()
        update_kwargs = self.mock_update.call_args.kwargs
        assert update_kwargs["channel"] == CHANNEL_ID
        assert update_kwargs["ts"] == MESSAGE_TS
        (button,) = update_kwargs["attachments"][0]["blocks"][1]["elements"]
        assert button["text"]["text"] == "Investigating…"
        assert button["url"] == link

        post_kwargs = self.mock_post_message.call_args.kwargs
        assert post_kwargs["channel"] == CHANNEL_ID
        assert post_kwargs["thread_ts"] == MESSAGE_TS
        assert link in str(post_kwargs["blocks"])

        assert SeerOperatorInvestigationCache[SlackInvestigationCachePayload].get(
            entrypoint_key="slack", investigation_id=investigation.id
        ) == SlackInvestigationCachePayload(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            channel_id=CHANNEL_ID,
            thread_ts=MESSAGE_TS,
            alert_message_ts=MESSAGE_TS,
            status_message_ts=STATUS_MESSAGE_TS,
            slack_user_id=self.external_id,
            last_sent_state=None,
            final_sent=False,
        )

    @with_feature(FEATURES)
    @patch("sentry.investigations.telemetry.sentry_sdk.metrics.count")
    def test_existing_investigation_replies_with_link(self, mock_count: MagicMock) -> None:
        self.click()
        response = self.click()

        (investigation,) = self.investigations()
        link = investigation.get_absolute_url()
        assert response.data["response_type"] == "ephemeral"
        assert response.data["text"] == (
            f"Seer is already investigating this alert. <{link}|View investigation>"
        )
        started_calls = [
            call for call in mock_count.call_args_list if call.args[0] == "investigations.started"
        ]
        assert len(started_calls) == 1
        assert self.mock_update.call_count == 1
        assert self.mock_post_message.call_count == 1

    @with_feature(FEATURES)
    def test_slack_error_during_update_still_creates_investigation(self) -> None:
        self.mock_update.side_effect = SlackApiError(
            "error", _slack_response({"ok": False, "error": "message_not_found"})
        )

        response = self.click()

        assert response.status_code == 200
        (investigation,) = self.investigations()
        self.mock_post_message.assert_called_once()
        cache_payload = SeerOperatorInvestigationCache[SlackInvestigationCachePayload].get(
            entrypoint_key="slack", investigation_id=investigation.id
        )
        assert cache_payload is not None
        assert cache_payload["status_message_ts"] == STATUS_MESSAGE_TS

    @with_feature(FEATURES)
    @patch(
        "sentry.seer.entrypoints.operator.create_agentic_breached_metric_investigation",
        side_effect=Exception("boom"),
    )
    def test_creation_error_sends_ephemeral_message(self, mock_create: MagicMock) -> None:
        response = self.click()

        assert response.status_code == 200
        assert self.investigations() == []
        ephemeral_kwargs = self.mock_post_ephemeral.call_args.kwargs
        assert ephemeral_kwargs["user"] == self.external_id
        assert ephemeral_kwargs["text"] == (
            "Seer couldn't start an investigation: An unexpected error occurred"
        )
        self.mock_update.assert_not_called()

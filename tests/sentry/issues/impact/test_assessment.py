from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from sentry.issues.impact.assessment import assess_impact_for_group
from sentry.issues.impact.types import IMPACT_FEATURE_ID
from sentry.testutils.cases import TestCase


class AssessImpactForGroupTest(TestCase):
    @patch("sentry.issues.impact.assessment.SeerAgentClient")
    def test_starts_seer_feature_run(self, mock_client_cls: MagicMock) -> None:
        event = self.store_event(
            data={
                "platform": "javascript",
                "exception": {"values": [{"type": "TypeError", "value": "Monitor details failed"}]},
                "_meta": {
                    "exception": {"values": {"0": {"value": {"": {"err": ["value was trimmed"]}}}}}
                },
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )
        assert event.group is not None
        expected_run = self.create_seer_run(organization=self.organization, type="feature_run")
        mock_client_cls.return_value.start_feature_run.return_value = expected_run

        with self.feature("organizations:seer-impact-assessment"):
            result = assess_impact_for_group(group=event.group)

        assert result is expected_run
        mock_client_cls.assert_called_once_with(
            self.organization, user=None, project=self.project, group=event.group
        )
        call = mock_client_cls.return_value.start_feature_run.call_args.kwargs
        assert call["feature_id"] == IMPACT_FEATURE_ID
        assert call["payload"]["group_id"] == event.group.id
        assert call["payload"]["project_id"] == self.project.id
        assert call["payload"]["source_event_id"] == event.event_id
        assert call["payload"]["available_citations"] == [
            {"source": "event", "reference": f"entire-event:{event.event_id}"}
        ]
        assert call["payload"]["project_context"] is None
        assert call["referrer"] == IMPACT_FEATURE_ID
        assert call["extras"] == {
            "source_event_id": event.event_id,
            "available_citation_references": [f"entire-event:{event.event_id}"],
        }

    def test_requires_an_event(self) -> None:
        group = self.create_group(project=self.project)

        with self.feature("organizations:seer-impact-assessment"):
            with pytest.raises(ValueError, match="has no event"):
                assess_impact_for_group(group=group)

    @patch("sentry.issues.impact.assessment.SeerAgentClient")
    def test_requires_feature(self, mock_client_cls: MagicMock) -> None:
        group = self.create_group(project=self.project)

        with pytest.raises(PermissionError, match="not enabled"):
            assess_impact_for_group(group=group)

        mock_client_cls.assert_not_called()

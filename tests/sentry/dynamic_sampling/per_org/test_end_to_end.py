from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from sentry.dynamic_sampling import RuleType, generate_rules
from sentry.dynamic_sampling.per_org.scheduler import run_calculations_per_org_task
from sentry.dynamic_sampling.rules.base import NEW_MODEL_THRESHOLD_IN_MINUTES
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule
from sentry.models.project import Project
from sentry.testutils.cases import SnubaTestCase, SpanTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options

BLENDED_SAMPLE_RATE = 0.25


class PerOrgEndToEndTest(TestCase, SnubaTestCase, SpanTestCase):
    """From stored spans, through one per-org pass, to the rules Relay is served.

    The pieces are covered on their own elsewhere: the EAP queries against stored spans,
    the pass against mocked queries, and the serving path against seeded caches. This
    test runs the whole chain on real data.
    """

    def setUp(self) -> None:
        super().setUp()
        # A recently added org or project is served at 100% before any balancing.
        self.old_date = timezone.now() - timedelta(minutes=NEW_MODEL_THRESHOLD_IN_MINUTES + 1)
        self.old_organization = self.create_organization(date_added=self.old_date)

    def create_project_with_segments(self, count: int) -> Project:
        project = self.create_project(organization=self.old_organization, date_added=self.old_date)
        # Only the rules the pass computes are of interest here.
        project.update_option(
            "sentry:dynamic_sampling_biases",
            [
                {"id": rule_type.value, "active": False}
                for rule_type in (
                    RuleType.BOOST_ENVIRONMENTS_RULE,
                    RuleType.IGNORE_HEALTH_CHECKS_RULE,
                    RuleType.BOOST_LATEST_RELEASES_RULE,
                    RuleType.BOOST_KEY_TRANSACTIONS_RULE,
                    RuleType.BOOST_LOW_VOLUME_TRANSACTIONS_RULE,
                    RuleType.BOOST_REPLAY_ID_RULE,
                )
            ],
        )
        # Recalibration measures the last five minutes, so the segments must be recent.
        timestamp = before_now(minutes=3)
        self.store_spans(
            [
                self.create_span(
                    {
                        "is_segment": True,
                        "sentry_tags": {
                            "transaction": "checkout",
                            "dsc.transaction": "checkout",
                            "dsc.project_id": str(project.id),
                        },
                    },
                    organization=self.old_organization,
                    project=project,
                    start_ts=timestamp + timedelta(milliseconds=index),
                )
                for index in range(count)
            ]
        )
        return project

    @staticmethod
    def rule(project: Project, rule_type: RuleType) -> PolymorphicRule:
        rules = {rule["id"]: rule for rule in generate_rules(project)}
        return rules[RESERVED_IDS[rule_type]]

    @with_feature("organizations:dynamic-sampling")
    @override_options(
        {
            "dynamic-sampling.per_org.rollout-rate": 1.0,
            "dynamic-sampling.per_org.serving-rollout-rate": 1.0,
        }
    )
    @patch("sentry.quotas.backend.get_blended_sample_rate", return_value=BLENDED_SAMPLE_RATE)
    def test_stored_segments_end_up_as_project_rules(self, get_blended_sample_rate) -> None:
        project_a = self.create_project_with_segments(9)
        project_b = self.create_project_with_segments(7)
        project_c = self.create_project_with_segments(3)
        project_d = self.create_project_with_segments(1)

        with self.tasks():
            assert run_calculations_per_org_task(self.old_organization.id) is None

        # The org rate of 25% is spread over the projects so that the low-volume ones keep
        # more of their traffic. These are the values the legacy pipeline produced as well.
        for project, expected_rate in (
            (project_a, 0.14814814814814817),
            (project_b, 0.1904761904761905),
            (project_c, 0.4444444444444444),
            (project_d, 1.0),
        ):
            assert self.rule(project, RuleType.BOOST_LOW_VOLUME_PROJECTS_RULE)["samplingValue"] == {
                "type": "sampleRate",
                "value": pytest.approx(expected_rate),
            }

        # Every stored segment counted in full, so the org sampled at 100% against a target
        # of 25% and the recalibration factor brings it back down.
        assert self.rule(project_a, RuleType.RECALIBRATION_RULE)["samplingValue"] == {
            "type": "factor",
            "value": pytest.approx(BLENDED_SAMPLE_RATE),
        }

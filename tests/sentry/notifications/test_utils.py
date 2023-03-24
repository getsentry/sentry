from typing import Dict, Sequence
from urllib.parse import parse_qs, urlparse

from sentry.issues.grouptype import (
    PerformanceNPlusOneAPICallsGroupType,
    PerformanceNPlusOneGroupType,
    PerformanceRenderBlockingAssetSpanGroupType,
)
from sentry.models import NotificationSetting, Rule
from sentry.notifications.helpers import (
    collect_groups_by_project,
    get_scope_type,
    get_settings_by_provider,
    get_subscription_from_attributes,
    get_target_id,
    get_values_by_provider_by_type,
    validate,
)
from sentry.notifications.notify import notification_providers
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.notifications.utils import (
    NotificationRuleDetails,
    NPlusOneAPICallProblemContext,
    PerformanceProblemContext,
    RenderBlockingAssetProblemContext,
    get_email_link_extra_params,
    get_group_settings_link,
    get_rules,
)
from sentry.testutils import TestCase
from sentry.types.integrations import ExternalProviders
from sentry.utils.performance_issues.performance_problem import PerformanceProblem


class MockEvent:
    data: dict
    transaction: str


class NotificationHelpersTest(TestCase):
    def setUp(self):
        super().setUp()

        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )

    def test_get_deploy_values_by_provider_empty_settings(self):
        values_by_provider = get_values_by_provider_by_type(
            {},
            notification_providers(),
            NotificationSettingTypes.DEPLOY,
        )
        assert values_by_provider == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.COMMITTED_ONLY,
            ExternalProviders.SLACK: NotificationSettingOptionValues.COMMITTED_ONLY,
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
        }

    def test_get_deploy_values_by_provider(self):
        notification_settings_by_scope = {
            NotificationScopeType.ORGANIZATION: {
                ExternalProviders.SLACK: NotificationSettingOptionValues.COMMITTED_ONLY
            },
            NotificationScopeType.USER: {
                ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS
            },
        }
        values_by_provider = get_values_by_provider_by_type(
            notification_settings_by_scope,
            notification_providers(),
            NotificationSettingTypes.DEPLOY,
        )
        assert values_by_provider == {
            ExternalProviders.EMAIL: NotificationSettingOptionValues.ALWAYS,
            ExternalProviders.SLACK: NotificationSettingOptionValues.COMMITTED_ONLY,
            ExternalProviders.MSTEAMS: NotificationSettingOptionValues.NEVER,
        }

    def test_validate(self):
        self.assertTrue(
            validate(NotificationSettingTypes.ISSUE_ALERTS, NotificationSettingOptionValues.ALWAYS)
        )
        self.assertTrue(
            validate(NotificationSettingTypes.ISSUE_ALERTS, NotificationSettingOptionValues.NEVER)
        )

        self.assertTrue(
            validate(NotificationSettingTypes.DEPLOY, NotificationSettingOptionValues.ALWAYS)
        )
        self.assertTrue(
            validate(NotificationSettingTypes.DEPLOY, NotificationSettingOptionValues.NEVER)
        )
        self.assertTrue(
            validate(
                NotificationSettingTypes.DEPLOY, NotificationSettingOptionValues.COMMITTED_ONLY
            )
        )
        self.assertFalse(
            validate(
                NotificationSettingTypes.DEPLOY, NotificationSettingOptionValues.SUBSCRIBE_ONLY
            )
        )

        self.assertTrue(
            validate(NotificationSettingTypes.WORKFLOW, NotificationSettingOptionValues.ALWAYS)
        )
        self.assertTrue(
            validate(NotificationSettingTypes.WORKFLOW, NotificationSettingOptionValues.NEVER)
        )
        self.assertTrue(
            validate(
                NotificationSettingTypes.WORKFLOW, NotificationSettingOptionValues.SUBSCRIBE_ONLY
            )
        )
        self.assertFalse(
            validate(
                NotificationSettingTypes.WORKFLOW, NotificationSettingOptionValues.COMMITTED_ONLY
            )
        )

    def test_get_scope_type(self):
        assert get_scope_type(NotificationSettingTypes.DEPLOY) == NotificationScopeType.ORGANIZATION
        assert get_scope_type(NotificationSettingTypes.WORKFLOW) == NotificationScopeType.PROJECT
        assert (
            get_scope_type(NotificationSettingTypes.ISSUE_ALERTS) == NotificationScopeType.PROJECT
        )
        assert not get_scope_type(NotificationSettingTypes.DEPLOY) == NotificationScopeType.PROJECT
        assert (
            not get_scope_type(NotificationSettingTypes.WORKFLOW)
            == NotificationScopeType.ORGANIZATION
        )
        assert (
            not get_scope_type(NotificationSettingTypes.ISSUE_ALERTS)
            == NotificationScopeType.ORGANIZATION
        )

    def test_get_target_id(self):
        assert get_target_id(self.user) == self.user.actor_id
        assert get_target_id(self.team) == self.team.actor_id

    def test_get_subscription_from_attributes(self):
        attrs = {"subscription": (True, True, None)}
        assert get_subscription_from_attributes(attrs) == (True, {"disabled": True})

        attrs = {"subscription": (True, False, None)}
        assert get_subscription_from_attributes(attrs) == (False, {"disabled": True})

    def test_collect_groups_by_project(self):
        assert collect_groups_by_project([self.group]) == {self.project.id: {self.group}}

    def test_get_settings_by_provider(self):
        settings = {
            NotificationScopeType.USER: {
                ExternalProviders.EMAIL: NotificationSettingOptionValues.NEVER
            }
        }
        assert get_settings_by_provider(settings) == {
            ExternalProviders.EMAIL: {
                NotificationScopeType.USER: NotificationSettingOptionValues.NEVER
            }
        }

    def test_get_group_settings_link(self):
        rule: Rule = self.create_project_rule(self.project)
        rule_details: Sequence[NotificationRuleDetails] = get_rules(
            [rule], self.organization, self.project
        )
        link = get_group_settings_link(
            self.group, self.environment.name, rule_details, 1337, extra="123"
        )

        parsed = urlparse(link)
        query_dict = dict(map(lambda x: (x[0], x[1][0]), parse_qs(parsed.query).items()))
        assert (
            parsed.scheme + "://" + parsed.hostname + parsed.path == self.group.get_absolute_url()
        )
        assert query_dict == {
            "referrer": "alert_email",
            "environment": self.environment.name,
            "alert_type": "email",
            "alert_timestamp": str(1337),
            "alert_rule_id": str(rule_details[0].id),
            "extra": "123",
        }

    def test_get_email_link_extra_params(self):
        rule: Rule = self.create_project_rule(self.project)
        project2 = self.create_project()
        rule2 = self.create_project_rule(project2)

        rule_details: Sequence[NotificationRuleDetails] = get_rules(
            [rule, rule2], self.organization, self.project
        )
        extra_params: Dict[int, str] = {
            k: dict(map(lambda x: (x[0], x[1][0]), parse_qs(v.strip("?")).items()))
            for k, v in get_email_link_extra_params(
                "digest_email", None, rule_details, 1337
            ).items()
        }

        assert extra_params == {
            rule_detail.id: {
                "referrer": "digest_email",
                "alert_type": "email",
                "alert_timestamp": str(1337),
                "alert_rule_id": str(rule_detail.id),
            }
            for rule_detail in rule_details
        }


class PerformanceProblemContextTestCase(TestCase):
    def test_creates_correct_context(self):
        assert (
            PerformanceProblemContext.from_problem_and_spans(
                PerformanceProblem(
                    fingerprint="",
                    op="",
                    desc="",
                    type=PerformanceNPlusOneGroupType,
                    parent_span_ids=[],
                    cause_span_ids=[],
                    offender_span_ids=[],
                    evidence_data={},
                    evidence_display=[],
                ),
                [],
            ).__class__
            == PerformanceProblemContext
        )

        assert (
            PerformanceProblemContext.from_problem_and_spans(
                PerformanceProblem(
                    fingerprint="",
                    op="",
                    desc="",
                    type=PerformanceNPlusOneAPICallsGroupType,
                    parent_span_ids=[],
                    cause_span_ids=[],
                    offender_span_ids=[],
                    evidence_data={},
                    evidence_display=[],
                ),
                [],
            ).__class__
            == NPlusOneAPICallProblemContext
        )

    def test_returns_n_plus_one_db_query_context(self):
        event = MockEvent()
        event.transaction = "sentry transaction"
        context = PerformanceProblemContext(
            PerformanceProblem(
                fingerprint=f"1-{PerformanceNPlusOneGroupType.type_id}-153198dd61706844cf3d9a922f6f82543df8125f",
                op="db",
                desc="SELECT * FROM table",
                type=PerformanceNPlusOneGroupType,
                parent_span_ids=["b93d2be92cd64fd5"],
                cause_span_ids=[],
                offender_span_ids=["054ba3a374d543eb"],
                evidence_data={},
                evidence_display=[],
            ),
            [
                {"span_id": "b93d2be92cd64fd5", "description": "SELECT * FROM parent_table"},
                {"span_id": "054ba3a374d543eb", "description": "SELECT * FROM table WHERE id=%s"},
            ],
            event,
        )

        assert context.to_dict() == {
            "transaction_name": "sentry transaction",
            "parent_span": "SELECT * FROM parent_table",
            "repeating_spans": "SELECT * FROM table WHERE id=%s",
            "num_repeating_spans": "1",
        }

    def test_returns_n_plus_one_api_call_context(self):
        event = MockEvent()
        event.transaction = "/resources"
        context = NPlusOneAPICallProblemContext(
            PerformanceProblem(
                fingerprint=f"1-{PerformanceNPlusOneAPICallsGroupType.type_id}-153198dd61706844cf3d9a922f6f82543df8125f",
                op="http.client",
                desc="/resources",
                type=PerformanceNPlusOneAPICallsGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["b93d2be92cd64fd5", "054ba3a374d543eb", "563712f9722fb09"],
                evidence_data={},
                evidence_display=[],
            ),
            [
                {
                    "span_id": "b93d2be92cd64fd5",
                    "description": "GET https://resource.io/resource?id=1",
                },
                {
                    "span_id": "054ba3a374d543eb",
                    "description": "GET https://resource.io/resource?id=2",
                },
                {"span_id": "563712f9722fb09", "description": "GET https://resource.io/resource"},
            ],
            event,
        )

        assert context.to_dict() == {
            "transaction_name": "/resources",
            "repeating_spans": "/resource",
            "parameters": ["{id: 1,2}"],
            "num_repeating_spans": "3",
        }

    def test_returns_render_blocking_asset_context(self):
        event = MockEvent()
        event.transaction = "/details"
        event.data = {
            "start_timestamp": 0,
            "timestamp": 3,
            "measurements": {"fcp": {"value": 1500, "unit": "milliseconds"}},
        }

        context = RenderBlockingAssetProblemContext(
            PerformanceProblem(
                fingerprint=f"1-{PerformanceRenderBlockingAssetSpanGroupType.type_id}-153198dd61706844cf3d9a922f6f82543df8125f",
                op="http.client",
                desc="/details",
                type=PerformanceRenderBlockingAssetSpanGroupType,
                parent_span_ids=[],
                cause_span_ids=[],
                offender_span_ids=["b93d2be92cd64fd5"],
                evidence_data={},
                evidence_display=[],
            ),
            [
                {
                    "op": "resource.script",
                    "span_id": "b93d2be92cd64fd5",
                    "description": "/assets/script.js",
                    "start_timestamp": 1677078164.09656,
                    "timestamp": 1677078165.09656,
                },
            ],
            event,
        )

        assert context.to_dict() == {
            "transaction_name": "/details",
            "slow_span_description": "/assets/script.js",
            "slow_span_duration": 1000,
            "transaction_duration": 3000,
            "fcp": 1500,
        }

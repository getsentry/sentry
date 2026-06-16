from typing import get_args

from django.urls import reverse

from sentry.models.orgauthtoken import OrgAuthToken
from sentry.preprod.api.models.public.size_status_check_rules import (
    SizeStatusCheckRuleArtifactType,
    SizeStatusCheckRuleFilterKey,
    SizeStatusCheckRuleFilterOperator,
    SizeStatusCheckRuleMeasurement,
    SizeStatusCheckRuleMetric,
)
from sentry.preprod.vcs.status_checks.size.rules import (
    ENABLED_OPTION_KEY,
    RULES_OPTION_KEY,
    VALID_STATUS_CHECK_FILTER_KEYS,
    VALID_STATUS_CHECK_FILTER_OPERATORS,
    VALID_STATUS_CHECK_MEASUREMENTS,
    VALID_STATUS_CHECK_METRICS,
)
from sentry.preprod.vcs.status_checks.size.tasks import _rule_matches_artifact
from sentry.preprod.vcs.status_checks.size.types import RuleArtifactType, StatusCheckRule
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils import json
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


class ProjectPreprodSizeAnalysisStatusCheckRulesEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-preprod-size-analysis-status-check-rules"

    def setUp(self) -> None:
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def _get_url(self, organization_slug=None, project_slug=None):
        return reverse(
            self.endpoint,
            args=[organization_slug or self.organization.slug, project_slug or self.project.slug],
        )

    def _get_with_user_token(self, scope_list=None, user=None, url=None):
        token = self.create_user_auth_token(
            user or self.user,
            scope_list=scope_list or ["project:read"],
        )
        return self.client.get(url or self._get_url(), HTTP_AUTHORIZATION=f"Bearer {token.token}")

    def _get_with_org_token(self, scope_list=None):
        token_str = generate_token(self.organization.slug, "")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="Test Token",
                token_hashed=hash_token(token_str),
                scope_list=scope_list or ["project:distribution"],
            )
        return self.client.get(self._get_url(), HTTP_AUTHORIZATION=f"Bearer {token_str}")

    def test_default_config_returns_enabled_with_empty_rules(self) -> None:
        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json() == {"enabled": True, "rules": []}

    def test_returns_configured_rules_public_contract(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            json.dumps(
                [
                    {
                        "id": "rule1",
                        "metric": "install_size",
                        "measurement": "absolute_diff",
                        "value": 5000000,
                        "filterQuery": "app_id:com.cameroncooke.test platform_name:apple",
                        "artifactType": "main_artifact",
                    },
                    {
                        "id": "rule2",
                        "metric": "download_size",
                        "measurement": "relative_diff",
                        "value": 10.5,
                        "filterQuery": "",
                        "artifactType": "all_artifacts",
                    },
                ]
            ),
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        data = response.json()
        assert data == {
            "enabled": True,
            "rules": [
                {
                    "id": "rule1",
                    "metric": "install_size",
                    "measurement": "absolute_diff",
                    "value": "5000000",
                    "filterQuery": "app_id:com.cameroncooke.test platform_name:apple",
                    "filters": [
                        {
                            "key": "app_id",
                            "conditions": [
                                {"operator": "equals", "values": ["com.cameroncooke.test"]}
                            ],
                        },
                        {
                            "key": "platform_name",
                            "conditions": [{"operator": "equals", "values": ["apple"]}],
                        },
                    ],
                    "artifactType": "main_artifact",
                },
                {
                    "id": "rule2",
                    "metric": "download_size",
                    "measurement": "relative_diff",
                    "value": "10.5",
                    "filterQuery": "",
                    "filters": [],
                    "artifactType": "all_artifacts",
                },
            ],
        }
        assert set(data["rules"][0]) == {
            "id",
            "metric",
            "measurement",
            "value",
            "filterQuery",
            "filters",
            "artifactType",
        }
        assert isinstance(data["rules"][0]["value"], str)

    def test_disabled_project_still_returns_saved_rules(self) -> None:
        self.project.update_option(ENABLED_OPTION_KEY, False)
        self.project.update_option(
            RULES_OPTION_KEY,
            json.dumps(
                [
                    {
                        "id": "rule1",
                        "metric": "install_size",
                        "measurement": "absolute",
                        "value": 100,
                    }
                ]
            ),
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json() == {
            "enabled": False,
            "rules": [
                {
                    "id": "rule1",
                    "metric": "install_size",
                    "measurement": "absolute",
                    "value": "100",
                    "filterQuery": "",
                    "filters": [],
                    "artifactType": "main_artifact",
                }
            ],
        }

    def test_legacy_rule_without_artifact_type_defaults_to_main_artifact(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            json.dumps(
                [
                    {
                        "id": "rule1",
                        "metric": "install_size",
                        "measurement": "absolute",
                        "value": 100,
                    }
                ]
            ),
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json()["rules"][0]["artifactType"] == "main_artifact"

    def test_malformed_config_returns_empty_rules(self) -> None:
        self.project.update_option(RULES_OPTION_KEY, "not-json")

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json() == {"enabled": True, "rules": []}

    def test_non_list_config_returns_empty_rules(self) -> None:
        self.project.update_option(RULES_OPTION_KEY, json.dumps({"id": "rule1"}))

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json() == {"enabled": True, "rules": []}

    def test_invalid_dict_rule_entries_are_skipped(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            [
                {"id": "bad", "metric": "install_size", "measurement": "absolute", "value": "100"},
                {"id": "rule1", "metric": "install_size", "measurement": "absolute", "value": 100},
            ],
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert [rule["id"] for rule in response.json()["rules"]] == ["rule1"]

    def test_non_dict_rule_entry_returns_empty_rules(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            [
                "not-a-rule",
                {"id": "rule1", "metric": "install_size", "measurement": "absolute", "value": 100},
            ],
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json() == {"enabled": True, "rules": []}

    def test_public_response_filters_unknown_metric_and_measurement(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            [
                {
                    "id": "unknown-metric",
                    "metric": "unknown",
                    "measurement": "absolute",
                    "value": 1,
                },
                {
                    "id": "unknown-measurement",
                    "metric": "install_size",
                    "measurement": "unknown",
                    "value": 2,
                },
                {"id": "rule1", "metric": "install_size", "measurement": "absolute", "value": 100},
            ],
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert [rule["id"] for rule in response.json()["rules"]] == ["rule1"]

    def test_filter_query_serializes_to_machine_readable_filters(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            [
                {
                    "id": "rule1",
                    "metric": "install_size",
                    "measurement": "absolute",
                    "value": 100,
                    "filterQuery": "app_id:com.foo app_id:com.bar app_id:[com.qux,com.quux] !app_id:com.baz !app_id:bad* !app_id:[com.bad,com.worse] platform_name:apple build_configuration_name:Release* git_head_ref:*main",
                },
            ],
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json()["rules"][0]["filters"] == [
            {
                "key": "app_id",
                "conditions": [
                    {"operator": "equals", "values": ["com.foo"]},
                    {"operator": "equals", "values": ["com.bar"]},
                    {"operator": "in", "values": ["com.qux", "com.quux"]},
                ],
            },
            {
                "key": "app_id",
                "conditions": [
                    {"operator": "notEquals", "values": ["com.baz"]},
                    {"operator": "notStartsWith", "values": ["bad"]},
                    {"operator": "notIn", "values": ["com.bad", "com.worse"]},
                ],
            },
            {"key": "platform_name", "conditions": [{"operator": "equals", "values": ["apple"]}]},
            {
                "key": "build_configuration_name",
                "conditions": [{"operator": "startsWith", "values": ["Release"]}],
            },
            {"key": "git_head_ref", "conditions": [{"operator": "endsWith", "values": ["main"]}]},
        ]

    def test_escaped_wildcards_serialize_as_literal_values(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            [
                {
                    "id": "rule1",
                    "metric": "install_size",
                    "measurement": "absolute",
                    "value": 100,
                    "filterQuery": r"app_id:\*com !app_id:com.example.\* platform_name:apple",
                },
            ],
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json()["rules"][0]["filters"] == [
            {
                "key": "app_id",
                "conditions": [{"operator": "equals", "values": ["*com"]}],
            },
            {
                "key": "app_id",
                "conditions": [{"operator": "notEquals", "values": ["com.example.*"]}],
            },
            {"key": "platform_name", "conditions": [{"operator": "equals", "values": ["apple"]}]},
        ]

    def test_complex_wildcards_serialize_as_matches_patterns(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            [
                {
                    "id": "rule1",
                    "metric": "install_size",
                    "measurement": "absolute",
                    "value": 100,
                    "filterQuery": "app_id:* app_id:*foo*bar* app_id:foo*bar !app_id:[foo*,*bar]",
                },
            ],
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json()["rules"][0]["filters"] == [
            {
                "key": "app_id",
                "conditions": [
                    {"operator": "matches", "values": ["*"]},
                    {"operator": "matches", "values": ["*foo*bar*"]},
                    {"operator": "matches", "values": ["foo*bar"]},
                ],
            },
            {
                "key": "app_id",
                "conditions": [{"operator": "notMatches", "values": ["foo*", "*bar"]}],
            },
        ]

    def test_wildcard_operator_escapes_value_wildcards_before_serializing(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            [
                {
                    "id": "rule1",
                    "metric": "install_size",
                    "measurement": "absolute",
                    "value": 100,
                    "filterQuery": "app_id:\uf00dStartsWith\uf00dblaaa*",
                },
            ],
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json()["rules"][0]["filters"] == [
            {
                "key": "app_id",
                "conditions": [{"operator": "startsWith", "values": ["blaaa*"]}],
            },
        ]

    def test_negated_in_filter_serialization_preserves_runtime_logic(self) -> None:
        filter_query = "!app_id:[com.foo,com.bar]"
        self.project.update_option(
            RULES_OPTION_KEY,
            [
                {
                    "id": "rule1",
                    "metric": "install_size",
                    "measurement": "absolute",
                    "value": 100,
                    "filterQuery": filter_query,
                },
            ],
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json()["rules"][0]["filters"] == [
            {
                "key": "app_id",
                "conditions": [{"operator": "notIn", "values": ["com.foo", "com.bar"]}],
            }
        ]
        runtime_rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100,
            filter_query=filter_query,
        )
        assert _rule_matches_artifact(runtime_rule, {"app_id": "com.foo"}) is False
        assert _rule_matches_artifact(runtime_rule, {"app_id": "com.baz"}) is True

    def test_invalid_filter_query_returns_null_filters(self) -> None:
        self.project.update_option(
            RULES_OPTION_KEY,
            [
                {
                    "id": "rule1",
                    "metric": "install_size",
                    "measurement": "absolute",
                    "value": 100,
                    "filterQuery": "unknown_key:value",
                },
            ],
        )

        response = self._get_with_user_token()

        assert response.status_code == 200
        assert response.json()["rules"][0]["filters"] is None
        runtime_rule = StatusCheckRule(
            id="rule1",
            metric="install_size",
            measurement="absolute",
            value=100,
            filter_query="unknown_key:value",
        )
        assert _rule_matches_artifact(runtime_rule, {"app_id": "com.foo"}) is False

    def test_denies_unauthenticated_request(self) -> None:
        response = self.client.get(self._get_url())

        assert response.status_code == 401

    def test_denies_token_without_expected_scope(self) -> None:
        response = self._get_with_user_token(scope_list=["event:read"])

        assert response.status_code == 403

    def test_allows_project_read_bearer_token(self) -> None:
        response = self._get_with_user_token(scope_list=["project:read"])

        assert response.status_code == 200

    def test_allows_project_read_org_token(self) -> None:
        response = self._get_with_org_token(scope_list=["project:read"])

        assert response.status_code == 200

    def test_denies_project_distribution_org_token(self) -> None:
        response = self._get_with_org_token(scope_list=["project:distribution"])

        assert response.status_code == 403

    def test_public_schema_literals_match_public_normalization_values(self) -> None:
        assert set(get_args(SizeStatusCheckRuleMetric)) == VALID_STATUS_CHECK_METRICS
        assert set(get_args(SizeStatusCheckRuleMeasurement)) == VALID_STATUS_CHECK_MEASUREMENTS
        assert set(get_args(SizeStatusCheckRuleFilterKey)) == VALID_STATUS_CHECK_FILTER_KEYS
        assert (
            set(get_args(SizeStatusCheckRuleFilterOperator)) == VALID_STATUS_CHECK_FILTER_OPERATORS
        )
        assert set(get_args(SizeStatusCheckRuleArtifactType)) == {
            artifact_type.value for artifact_type in RuleArtifactType
        }

    def test_denies_other_organization_access(self) -> None:
        other_user = self.create_user()
        other_organization = self.create_organization(owner=other_user)
        other_project = self.create_project(organization=other_organization)
        url = self._get_url(other_organization.slug, other_project.slug)

        response = self._get_with_user_token(user=self.user, url=url)

        assert response.status_code == 403

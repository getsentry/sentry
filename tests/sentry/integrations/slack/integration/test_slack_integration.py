from sentry.integrations.slack import SlackIntegration
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


class _BaseTestCase(TestCase):
    def setUp(self) -> None:
        self.slack_provider_integration = self.create_provider_integration(
            provider="slack", name="Slack", metadata={}
        )
        self.slack_installation = SlackIntegration(
            self.slack_provider_integration, self.organization.id
        )


@control_silo_test
class TestGetOrganizationConfig(_BaseTestCase):
    def test_gets_default_flags_when_no_data_exists(self) -> None:
        self.create_organization_integration(
            organization_id=self.organization.id,
            integration=self.slack_provider_integration,
            config={},
        )
        results = self.slack_installation.get_organization_config()
        assert results == [
            ("ISSUE_ALERTS_THREAD_FLAG", True),
            ("METRIC_ALERTS_THREAD_FLAG", True),
        ]

    def test_gets_missing_flags(self) -> None:
        self.create_organization_integration(
            organization_id=self.organization.id,
            integration=self.slack_provider_integration,
            config={
                "TOGGLEABLE_FLAGS": {
                    "ISSUE_ALERTS_THREAD_FLAG": False,
                }
            },
        )
        results = self.slack_installation.get_organization_config()
        assert results == [
            ("ISSUE_ALERTS_THREAD_FLAG", False),
            ("METRIC_ALERTS_THREAD_FLAG", True),
        ]

    def test_gets_correct_data(self) -> None:
        self.create_organization_integration(
            organization_id=self.organization.id,
            integration=self.slack_provider_integration,
            config={
                "TOGGLEABLE_FLAGS": {
                    "ISSUE_ALERTS_THREAD_FLAG": False,
                    "METRIC_ALERTS_THREAD_FLAG": False,
                }
            },
        )
        results = self.slack_installation.get_organization_config()
        assert results == [
            ("ISSUE_ALERTS_THREAD_FLAG", False),
            ("METRIC_ALERTS_THREAD_FLAG", False),
        ]

    def test_ignores_unsupported_flags(self) -> None:
        self.create_organization_integration(
            organization_id=self.organization.id,
            integration=self.slack_provider_integration,
            config={
                "TOGGLEABLE_FLAGS": {
                    "ISSUE_ALERTS_THREAD_FLAG": False,
                    "METRIC_ALERTS_THREAD_FLAG": False,
                    "SOME_OTHER_KEY": True,
                    "KEY": True,
                }
            },
        )
        results = self.slack_installation.get_organization_config()
        assert results == [
            ("ISSUE_ALERTS_THREAD_FLAG", False),
            ("METRIC_ALERTS_THREAD_FLAG", False),
        ]


@control_silo_test
class TestUpdateAndCleanFlagsInOrganizationConfig(_BaseTestCase):
    def test_adds_flags_key_when_it_does_not_exist(self) -> None:
        data = {}
        self.slack_installation._update_and_clean_flags_in_organization_config(data=data)

        assert "TOGGLEABLE_FLAGS" in data

    def test_adds_default_flags_key_when_it_does_not_exist(self) -> None:
        data = {}
        self.slack_installation._update_and_clean_flags_in_organization_config(data=data)

        results = data["TOGGLEABLE_FLAGS"]
        assert results == {
            "ISSUE_ALERTS_THREAD_FLAG": True,
            "METRIC_ALERTS_THREAD_FLAG": True,
        }

    def test_adds_missing_flags(self) -> None:
        data = {
            "TOGGLEABLE_FLAGS": {
                "ISSUE_ALERTS_THREAD_FLAG": False,
            }
        }
        self.slack_installation._update_and_clean_flags_in_organization_config(data=data)

        results = data["TOGGLEABLE_FLAGS"]
        assert results == {
            "ISSUE_ALERTS_THREAD_FLAG": False,
            "METRIC_ALERTS_THREAD_FLAG": True,
        }

    def test_corrects_bad_flag_values(self) -> None:
        data = {
            "TOGGLEABLE_FLAGS": {
                "ISSUE_ALERTS_THREAD_FLAG": False,
                "METRIC_ALERTS_THREAD_FLAG": 0,
            }
        }
        self.slack_installation._update_and_clean_flags_in_organization_config(data=data)

        results = data["TOGGLEABLE_FLAGS"]
        assert results == {
            "ISSUE_ALERTS_THREAD_FLAG": False,
            "METRIC_ALERTS_THREAD_FLAG": True,
        }


@control_silo_test
class TestUpdateOrganizationConfig(_BaseTestCase):
    def test_saves_flags(self) -> None:
        org_integration = self.create_organization_integration(
            organization_id=self.organization.id,
            integration=self.slack_provider_integration,
            config={},
        )
        data = {
            "TOGGLEABLE_FLAGS": {
                "ISSUE_ALERTS_THREAD_FLAG": False,
                "METRIC_ALERTS_THREAD_FLAG": True,
            }
        }
        self.slack_installation.update_organization_config(data=data)

        org_integration.refresh_from_db()
        assert org_integration.config == data

from sentry.seer.autofix.pr_iteration.project_setting import (
    get_pr_iteration_settings,
    pr_iteration_default,
    pr_iteration_enabled_for_group,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class PrIterationDefaultTest(TestCase):
    def test_on_without_token_based_billing(self) -> None:
        assert pr_iteration_default(self.organization) is True

    @with_feature("organizations:token-billed-seer-enabled")
    def test_off_under_token_based_billing(self) -> None:
        assert pr_iteration_default(self.organization) is False


class PrIterationEnabledForGroupTest(TestCase):
    def test_on_by_default(self) -> None:
        assert pr_iteration_enabled_for_group(self.group.id) is True

    @with_feature("organizations:token-billed-seer-enabled")
    def test_off_by_default_under_token_based_billing(self) -> None:
        assert pr_iteration_enabled_for_group(self.group.id) is False

    @with_feature("organizations:token-billed-seer-enabled")
    def test_turned_on_under_token_based_billing(self) -> None:
        self.project.update_option("sentry:seer_pr_iteration", True)

        assert pr_iteration_enabled_for_group(self.group.id) is True

    def test_turned_off(self) -> None:
        self.project.update_option("sentry:seer_pr_iteration", False)

        assert pr_iteration_enabled_for_group(self.group.id) is False

    def test_missing_group_reads_as_on(self) -> None:
        assert pr_iteration_enabled_for_group(0) is True


class GetPrIterationSettingsTest(TestCase):
    @with_feature("organizations:token-billed-seer-enabled")
    def test_applies_the_org_default_to_projects_that_never_chose(self) -> None:
        chose_on = self.create_project(organization=self.organization)
        chose_on.update_option("sentry:seer_pr_iteration", True)
        never_chose = self.create_project(organization=self.organization)

        settings = get_pr_iteration_settings(self.organization, [chose_on, never_chose])

        assert settings == {chose_on.id: True, never_chose.id: False}

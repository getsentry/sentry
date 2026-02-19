from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.notifications.services.mass_notification.service import mass_notification_service
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@all_silo_test
class MassNotifyByIntegrationTest(TransactionTestCase):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.REGION):
            self.org1 = self.create_organization()
            self.org2 = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.org1,
                external_id="ext-1",
                provider="slack",
            )
            OrganizationIntegration.objects.create(
                organization_id=self.org2.id,
                integration=self.integration,
            )

    def test_success_multiple_orgs(self) -> None:
        result = mass_notification_service.mass_notify_by_integration(
            integration_id=self.integration.id,
            message="hello",
        )
        assert result.success is True
        assert result.notified_count == 2
        assert set(result.organization_ids) == {self.org1.id, self.org2.id}
        assert result.error_str is None

    def test_integration_not_found(self) -> None:
        result = mass_notification_service.mass_notify_by_integration(
            integration_id=999999,
            message="hello",
        )
        assert result.success is False
        assert result.notified_count == 0
        assert result.error_str is not None


@all_silo_test
class MassNotifyByUserOrganizationsTest(TransactionTestCase):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user = self.create_user()
        with assume_test_silo_mode(SiloMode.REGION):
            self.org1 = self.create_organization(owner=self.user)
            self.org2 = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.org1,
                external_id="ext-1",
                provider="slack",
            )

    def test_success(self) -> None:
        result = mass_notification_service.mass_notify_by_user_organizations(
            user_id=self.user.id,
            message="hello",
        )
        assert result.success is True
        assert result.notified_count >= 1
        assert self.org1.id in result.organization_ids

    def test_no_orgs_user(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            lonely_user = self.create_user()
            OrganizationMemberMapping.objects.filter(user_id=lonely_user.id).delete()

        result = mass_notification_service.mass_notify_by_user_organizations(
            user_id=lonely_user.id,
            message="hello",
        )
        assert result.success is False
        assert result.notified_count == 0
        assert result.error_str is not None


@all_silo_test
class MassNotifyByVibesTest(TransactionTestCase):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.REGION):
            self.org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.slack_integration = self.create_integration(
                organization=self.org,
                external_id="ext-slack",
                provider="slack",
                name="Slack Integration",
            )
            self.github_integration = self.create_integration(
                organization=self.org,
                external_id="ext-github",
                provider="github",
                name="GitHub Integration",
            )

    def test_vibe_match(self) -> None:
        result = mass_notification_service.mass_notify_by_vibes(
            organization_id=self.org.id,
            message="hello",
            vibe="slack",
        )
        assert result.success is True
        assert result.notified_count == 1
        assert self.org.id in result.organization_ids

    def test_no_match_fallback(self) -> None:
        result = mass_notification_service.mass_notify_by_vibes(
            organization_id=self.org.id,
            message="hello",
            vibe="nonexistent",
        )
        assert result.success is True
        assert result.notified_count == 2

    def test_no_integrations_for_org(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            empty_org = self.create_organization()

        result = mass_notification_service.mass_notify_by_vibes(
            organization_id=empty_org.id,
            message="hello",
            vibe="slack",
        )
        assert result.success is False
        assert result.notified_count == 0
        assert result.error_str is not None

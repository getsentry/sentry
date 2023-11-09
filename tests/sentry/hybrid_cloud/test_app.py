from typing import List

from django.core.cache import cache

from sentry.constants import SentryAppInstallationStatus
from sentry.models.integrations.sentry_app import SentryApp
from sentry.models.integrations.sentry_app_component import SentryAppComponent
from sentry.services.hybrid_cloud.app import app_service
from sentry.services.hybrid_cloud.app.model import RpcSentryAppService
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, region_silo_test


@django_db_all(transaction=True)
@all_silo_test(stable=True)
def test_create_internal_integration_for_channel_request():
    org = Factories.create_organization()
    integration_creator = Factories.create_user(email="test@sentry.io")
    first_app = app_service.create_internal_integration_for_channel_request(
        organization_id=org.id,
        integration_name="Test Integration",
        integration_scopes=["prject:read"],
        integration_creator_id=integration_creator.id,
        metadata={"partnership_restricted": True},
    )
    assert first_app.sentry_app.metadata["partnership_restricted"]

    second_app = app_service.create_internal_integration_for_channel_request(
        organization_id=org.id,
        integration_creator_id=integration_creator.id,
        integration_name="Test Integration",
        integration_scopes=["prject:read"],
    )
    assert first_app.id == second_app.id


@region_silo_test(stable=True)
class AppServiceTest(TestCase):
    def test_find_alertable_services(self):
        org = self.create_organization()
        app1 = self.create_internal_integration(organization_id=org.id, is_alertable=True)
        app2 = self.create_internal_integration(organization_id=org.id, is_alertable=True)
        self.create_internal_integration(
            organization_id=org.id,
            is_alertable=False,
        )
        cache.clear()
        result: List[RpcSentryAppService] = []
        with self.assertNumQueries(0):
            apps = SentryApp.objects.filter(
                installations__organization_id=org.id,
                is_alertable=True,
                installations__status=SentryAppInstallationStatus.INSTALLED,
                installations__date_deleted=None,
            ).distinct()
            for app in apps:
                if SentryAppComponent.objects.filter(
                    sentry_app_id=app.id, type="alert-rule-action"
                ).exists():
                    continue
                result.append(
                    RpcSentryAppService(
                        title=app.name,
                        slug=app.slug,
                    )
                )
        assert len(result) == 2
        assert result[0].title in [app1.name, app2.name]
        assert result[1].title in [app1.name, app2.name]

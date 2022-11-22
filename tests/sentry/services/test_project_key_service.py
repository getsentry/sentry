import pytest
from django.test import override_settings

from sentry.services.hybrid_cloud.project_key import project_key_service
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.hybrid_cloud import use_real_service
from sentry.web.client_config import get_client_config


@pytest.mark.django_db
def test_project_key_service():
    organization = Factories.create_organization(name="test-org")
    project = Factories.create_project(organization=organization)
    project_key = Factories.create_project_key(project)
    assert project_key.dsn_public

    with override_settings(SENTRY_PROJECT=project.id):
        with use_real_service(project_key_service, SiloMode.CONTROL):
            assert get_client_config()["dsn"] == project_key.dsn_public

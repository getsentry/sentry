from django.test import override_settings

from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.web.client_config import get_client_config


@django_db_all
def test_project_key_service():
    organization = Factories.create_organization(name="test-org")
    project = Factories.create_project(organization=organization)
    project_key = Factories.create_project_key(project)
    assert project_key.dsn_public

    with override_settings(SENTRY_PROJECT=project.id):
        assert get_client_config()["dsn"] == project_key.dsn_public

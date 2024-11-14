from unittest import mock

import pytest
from django.test import override_settings

from sentry.models.projectkey import ProjectKey, ProjectKeyManager, ProjectKeyStatus
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import create_test_regions, region_silo_test


@region_silo_test(regions=create_test_regions("us"), include_monolith_run=True)
class ProjectKeyTest(TestCase):
    model = ProjectKey

    def setUp(self):
        super().setUp()
        self.project = self.create_project(organization=self.organization)

    def test_get_dsn_custom_prefix(self):
        key = ProjectKey(project_id=self.project.id, public_key="public", secret_key="secret")
        with self.options(
            {"system.url-prefix": "http://example.com", "system.region-api-url-template": ""}
        ):
            self.assertEqual(key.get_dsn(), f"http://public:secret@example.com/{self.project.id}")

    def test_get_dsn_with_ssl(self):
        key = ProjectKey(project_id=self.project.id, public_key="public", secret_key="secret")
        with self.options(
            {"system.url-prefix": "https://example.com", "system.region-api-url-template": ""}
        ):
            self.assertEqual(key.get_dsn(), f"https://public:secret@example.com/{self.project.id}")

    def test_get_dsn_with_port(self):
        key = ProjectKey(project_id=self.project.id, public_key="public", secret_key="secret")
        with self.options(
            {"system.url-prefix": "http://example.com:81", "system.region-api-url-template": ""}
        ):
            self.assertEqual(
                key.get_dsn(), f"http://public:secret@example.com:81/{self.project.id}"
            )

    def test_get_dsn_with_public_endpoint_setting(self):
        key = ProjectKey(project_id=self.project.id, public_key="public", secret_key="secret")
        with self.settings(SENTRY_PUBLIC_ENDPOINT="http://public_endpoint.com"):
            self.assertEqual(
                key.get_dsn(public=True), f"http://public@public_endpoint.com/{self.project.id}"
            )

    def test_get_dsn_with_endpoint_setting(self):
        key = ProjectKey(project_id=self.project.id, public_key="public", secret_key="secret")
        with self.settings(SENTRY_ENDPOINT="http://endpoint.com"):
            self.assertEqual(key.get_dsn(), f"http://public:secret@endpoint.com/{self.project.id}")

    def test_key_is_created_for_project(self):
        self.create_user("admin@example.com")
        team = self.create_team(name="Test")
        project = self.create_project(name="Test", teams=[team])
        assert project.key_set.exists() is True

    def test_generate_api_key(self):
        assert len(self.model.generate_api_key()) == 32

    def test_from_dsn(self):
        key = self.model.objects.create(
            project_id=self.project.id, public_key="abc", secret_key="xyz"
        )

        assert self.model.from_dsn(f"http://abc@testserver/{self.project.id}") == key
        assert self.model.from_dsn(f"http://abc@o1.ingest.testserver/{self.project.id}") == key

        with pytest.raises(self.model.DoesNotExist):
            self.model.from_dsn("http://xxx@testserver/1")

        with pytest.raises(self.model.DoesNotExist):
            self.model.from_dsn("abc")

    def test_get_default(self):
        key = self.projectkey
        self.model.objects.create(project=self.project, status=ProjectKeyStatus.INACTIVE)
        assert (
            self.model.objects.filter(project=self.project).count() == 2
        ), self.model.objects.all()
        assert self.model.get_default(self.project) == key

    def test_is_active(self):
        assert self.model(project=self.project, status=ProjectKeyStatus.INACTIVE).is_active is False

        assert self.model(project=self.project, status=ProjectKeyStatus.ACTIVE).is_active is True

    def test_get_dsn(self):
        with self.options({"system.region-api-url-template": ""}):
            key = self.model(project_id=self.project.id, public_key="abc", secret_key="xyz")
            assert key.dsn_private == f"http://abc:xyz@testserver/{self.project.id}"
            assert key.dsn_public == f"http://abc@testserver/{self.project.id}"
            assert (
                key.csp_endpoint
                == f"http://testserver/api/{self.project.id}/csp-report/?sentry_key=abc"
            )
            assert (
                key.minidump_endpoint
                == f"http://testserver/api/{self.project.id}/minidump/?sentry_key=abc"
            )
            assert key.unreal_endpoint == f"http://testserver/api/{self.project.id}/unreal/abc/"
            assert (
                key.crons_endpoint
                == f"http://testserver/api/{self.project.id}/cron/___MONITOR_SLUG___/abc/"
            )
            assert key.js_sdk_loader_cdn_url == "http://testserver/js-sdk-loader/abc.min.js"

    def test_get_dsn_org_subdomain(self):
        with (
            self.feature("organizations:org-ingest-subdomains"),
            self.options({"system.region-api-url-template": ""}),
        ):
            key = self.model(project_id=self.project.id, public_key="abc", secret_key="xyz")
            host = f"o{key.project.organization_id}.ingest.testserver"

            assert key.dsn_private == f"http://abc:xyz@{host}/{self.project.id}"
            assert key.dsn_public == f"http://abc@{host}/{self.project.id}"
            assert (
                key.csp_endpoint
                == f"http://{host}/api/{self.project.id}/csp-report/?sentry_key=abc"
            )
            assert (
                key.minidump_endpoint
                == f"http://{host}/api/{self.project.id}/minidump/?sentry_key=abc"
            )
            assert key.unreal_endpoint == f"http://{host}/api/{self.project.id}/unreal/abc/"
            assert (
                key.crons_endpoint
                == f"http://{host}/api/{self.project.id}/cron/___MONITOR_SLUG___/abc/"
            )

    @override_settings(SENTRY_REGION="us")
    def test_get_dsn_multiregion(self):
        key = self.model(project_id=self.project.id, public_key="abc", secret_key="xyz")
        host = "us.testserver" if SiloMode.get_current_mode() == SiloMode.REGION else "testserver"

        assert key.dsn_private == f"http://abc:xyz@{host}/{self.project.id}"
        assert key.dsn_public == f"http://abc@{host}/{self.project.id}"
        assert key.csp_endpoint == f"http://{host}/api/{self.project.id}/csp-report/?sentry_key=abc"
        assert (
            key.minidump_endpoint == f"http://{host}/api/{self.project.id}/minidump/?sentry_key=abc"
        )
        assert key.unreal_endpoint == f"http://{host}/api/{self.project.id}/unreal/abc/"
        assert (
            key.crons_endpoint
            == f"http://{host}/api/{self.project.id}/cron/___MONITOR_SLUG___/abc/"
        )

    @override_settings(SENTRY_REGION="us")
    def test_get_dsn_org_subdomain_and_multiregion(self):
        with self.feature("organizations:org-ingest-subdomains"):
            key = self.model(project_id=self.project.id, public_key="abc", secret_key="xyz")
            host = f"o{key.project.organization_id}.ingest." + (
                "us.testserver" if SiloMode.get_current_mode() == SiloMode.REGION else "testserver"
            )

            assert key.dsn_private == f"http://abc:xyz@{host}/{self.project.id}"
            assert key.dsn_public == f"http://abc@{host}/{self.project.id}"
            assert (
                key.csp_endpoint
                == f"http://{host}/api/{self.project.id}/csp-report/?sentry_key=abc"
            )
            assert (
                key.minidump_endpoint
                == f"http://{host}/api/{self.project.id}/minidump/?sentry_key=abc"
            )
            assert key.unreal_endpoint == f"http://{host}/api/{self.project.id}/unreal/abc/"
            assert (
                key.crons_endpoint
                == f"http://{host}/api/{self.project.id}/cron/___MONITOR_SLUG___/abc/"
            )


@mock.patch("sentry.models.projectkey.schedule_invalidate_project_config")
@django_db_all
def test_key_deleted_projconfig_invalidated(inv_proj_config, default_project):
    assert inv_proj_config.call_count == 0

    key = ProjectKey.objects.get(project=default_project)
    manager = ProjectKeyManager()
    manager.post_delete(key)

    assert inv_proj_config.call_count == 1


@mock.patch("sentry.models.projectkey.schedule_invalidate_project_config")
@django_db_all
def test_key_saved_projconfig_invalidated(inv_proj_config, default_project):
    assert inv_proj_config.call_count == 0

    key = ProjectKey.objects.get(project=default_project)
    manager = ProjectKeyManager()
    manager.post_save(instance=key, created=False)

    assert inv_proj_config.call_count == 1

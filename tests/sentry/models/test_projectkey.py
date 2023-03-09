from unittest import mock

import pytest

from sentry.models.projectkey import ProjectKey, ProjectKeyManager, ProjectKeyStatus
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class ProjectKeyTest(TestCase):
    model = ProjectKey

    def test_get_dsn_custom_prefix(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.options({"system.url-prefix": "http://example.com"}):
            self.assertEqual(key.get_dsn(), "http://public:secret@example.com/1")

    def test_get_dsn_with_ssl(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.options({"system.url-prefix": "https://example.com"}):
            self.assertEqual(key.get_dsn(), "https://public:secret@example.com/1")

    def test_get_dsn_with_port(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.options({"system.url-prefix": "http://example.com:81"}):
            self.assertEqual(key.get_dsn(), "http://public:secret@example.com:81/1")

    def test_get_dsn_with_public_endpoint_setting(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.settings(SENTRY_PUBLIC_ENDPOINT="http://public_endpoint.com"):
            self.assertEqual(key.get_dsn(public=True), "http://public@public_endpoint.com/1")

    def test_get_dsn_with_endpoint_setting(self):
        key = ProjectKey(project_id=1, public_key="public", secret_key="secret")
        with self.settings(SENTRY_ENDPOINT="http://endpoint.com"):
            self.assertEqual(key.get_dsn(), "http://public:secret@endpoint.com/1")

    def test_key_is_created_for_project(self):
        self.create_user("admin@example.com")
        team = self.create_team(name="Test")
        project = self.create_project(name="Test", teams=[team])
        assert project.key_set.exists() is True

    def test_generate_api_key(self):
        assert len(self.model.generate_api_key()) == 32

    def test_from_dsn(self):
        key = self.model.objects.create(project_id=1, public_key="abc", secret_key="xyz")

        assert self.model.from_dsn("http://abc@testserver/1") == key
        assert self.model.from_dsn("http://abc@o1.ingest.testserver/1") == key

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
        key = self.model(project_id=1, public_key="abc", secret_key="xyz")
        assert key.dsn_private == "http://abc:xyz@testserver/1"
        assert key.dsn_public == "http://abc@testserver/1"
        assert key.csp_endpoint == "http://testserver/api/1/csp-report/?sentry_key=abc"
        assert key.minidump_endpoint == "http://testserver/api/1/minidump/?sentry_key=abc"
        assert key.unreal_endpoint == "http://testserver/api/1/unreal/abc/"
        assert key.js_sdk_loader_cdn_url == "http://testserver/js-sdk-loader/abc.min.js"

    def test_get_dsn_org_subdomain(self):
        with self.feature("organizations:org-subdomains"):
            key = self.model(project_id=1, public_key="abc", secret_key="xyz")
            host = f"o{key.project.organization_id}.ingest.testserver"

            assert key.dsn_private == f"http://abc:xyz@{host}/1"
            assert key.dsn_public == f"http://abc@{host}/1"
            assert key.csp_endpoint == f"http://{host}/api/1/csp-report/?sentry_key=abc"
            assert key.minidump_endpoint == f"http://{host}/api/1/minidump/?sentry_key=abc"
            assert key.unreal_endpoint == f"http://{host}/api/1/unreal/abc/"


@mock.patch("sentry.models.projectkey.schedule_invalidate_project_config")
@pytest.mark.django_db(transaction=True)
def test_key_deleted_projconfig_invalidated(inv_proj_config, default_project):
    assert inv_proj_config.call_count == 0

    key = ProjectKey.objects.get(project=default_project)
    manager = ProjectKeyManager()
    manager.post_delete(key)

    assert inv_proj_config.call_count == 1


@mock.patch("sentry.models.projectkey.schedule_invalidate_project_config")
@pytest.mark.django_db(transaction=True)
def test_key_saved_projconfig_invalidated(inv_proj_config, default_project):
    assert inv_proj_config.call_count == 0

    key = ProjectKey.objects.get(project=default_project)
    manager = ProjectKeyManager()
    manager.post_save(key)

    assert inv_proj_config.call_count == 1

from __future__ import absolute_import

from sentry.models import ProjectKey, ProjectKeyStatus
from sentry.testutils import TestCase


class ProjectKeyTest(TestCase):
    model = ProjectKey

    def test_generate_api_key(self):
        assert len(self.model.generate_api_key()) == 32

    def test_from_dsn(self):
        key = self.model.objects.create(project_id=1, public_key="abc", secret_key="xyz")

        assert self.model.from_dsn("http://abc@testserver/1") == key
        assert self.model.from_dsn("http://abc@o1.ingest.testserver/1") == key

        with self.assertRaises(self.model.DoesNotExist):
            self.model.from_dsn("http://xxx@testserver/1")

        with self.assertRaises(self.model.DoesNotExist):
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

    def test_get_dsn_org_subdomain(self):
        with self.feature("organizations:org-subdomains"):
            key = self.model(project_id=1, public_key="abc", secret_key="xyz")
            host = "o{}.ingest.testserver".format(key.project.organization_id)

            assert key.dsn_private == "http://abc:xyz@{}/1".format(host)
            assert key.dsn_public == "http://abc@{}/1".format(host)
            assert key.csp_endpoint == "http://{}/api/1/csp-report/?sentry_key=abc".format(host)
            assert key.minidump_endpoint == "http://{}/api/1/minidump/?sentry_key=abc".format(host)
            assert key.unreal_endpoint == "http://{}/api/1/unreal/abc/".format(host)

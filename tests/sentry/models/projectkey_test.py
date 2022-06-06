from sentry.models.projectkey import ProjectKey
from sentry.testutils import TestCase


class ProjectKeyTest(TestCase):
    def test_get_dsn(self):
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

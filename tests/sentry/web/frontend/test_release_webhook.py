import hmac
from functools import cached_property
from hashlib import sha256

from django.urls import reverse

from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.utils import json


class ReleaseWebhookTestBase(TestCase):
    plugin_id: str

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(teams=[self.team])
        self.token = "a2587e3af83411e4a28634363b8514c2"
        ProjectOption.objects.set_value(self.project, "sentry:release-token", self.token)

    @cached_property
    def signature(self) -> str:
        return hmac.new(
            key=self.token.encode("utf-8"),
            msg=(f"{self.plugin_id}-{self.project.id}").encode(),
            digestmod=sha256,
        ).hexdigest()

    @cached_property
    def path(self) -> str:
        return reverse(
            "sentry-release-hook",
            kwargs={
                "project_id": self.project.id,
                "plugin_id": self.plugin_id,
                "signature": self.signature,
            },
        )


class ReleaseWebhookTest(ReleaseWebhookTestBase):
    def setUp(self) -> None:
        super().setUp()
        self.plugin_id = "dummy"

    def test_no_token(self) -> None:
        project = self.create_project(teams=[self.team])
        path = reverse(
            "sentry-release-hook",
            kwargs={"project_id": project.id, "plugin_id": "dummy", "signature": self.signature},
        )
        resp = self.client.post(path)
        assert resp.status_code == 403

    def test_invalid_signature(self) -> None:
        path = reverse(
            "sentry-release-hook",
            kwargs={"project_id": self.project.id, "plugin_id": "dummy", "signature": "wrong"},
        )
        resp = self.client.post(path)
        assert resp.status_code == 403

    def test_invalid_project(self) -> None:
        path = reverse(
            "sentry-release-hook",
            kwargs={"project_id": 1000000, "plugin_id": "dummy", "signature": self.signature},
        )
        resp = self.client.post(path)
        assert resp.status_code == 404

        path = reverse(
            "sentry-release-hook",
            kwargs={"project_id": "dummy", "plugin_id": "dummy", "signature": self.signature},
        )
        resp = self.client.post(path)
        assert resp.status_code == 404


class BuiltinReleaseWebhookTest(ReleaseWebhookTestBase):
    def setUp(self) -> None:
        super().setUp()
        self.plugin_id = "builtin"

    def test_invalid_params(self) -> None:
        resp = self.client.post(self.path, content_type="application/json")
        assert resp.status_code == 400

    def test_valid_params(self) -> None:
        resp = self.client.post(
            self.path, data=json.dumps({"version": "a"}), content_type="application/json"
        )
        assert resp.status_code == 201, resp.content
        data = json.loads(resp.content)
        assert data["version"] == "a"

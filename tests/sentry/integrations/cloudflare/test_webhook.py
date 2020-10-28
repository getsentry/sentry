from __future__ import absolute_import

from hashlib import sha256
import hmac
import six

from sentry import options
from sentry.utils import json
from sentry.models import ApiToken, ProjectKey
from sentry.testutils import TestCase

UNSET = object()


class BaseWebhookTest(TestCase):
    def setUp(self):
        super(BaseWebhookTest, self).setUp()
        self.user = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.team = self.create_team(organization=self.org)
        self.create_member(organization=self.org, user=self.user, role="owner", teams=[self.team])
        self.project = self.create_project(name="a", teams=[self.team])
        self.token = ApiToken.objects.create(
            user=self.user, token="55838c83b3ec4e3ebc24c10c7bd071ffb1dc91161d3d49aeaedd9bd35d84bbe2"
        )
        self.key = ProjectKey.objects.get_or_create(project=self.project)[0]

    def post_webhook(self, data, signature=UNSET, variant=UNSET, key=None):
        if key is None:
            key = options.get("cloudflare.secret-key")
        if not isinstance(data, six.string_types):
            body = json.dumps(data)
        else:
            body = data
        if signature is UNSET:
            signature = hmac.new(
                key=key.encode("utf-8"), msg=body.encode("utf-8"), digestmod=sha256
            ).hexdigest()
        if variant is UNSET:
            variant = "1"

        headers = {
            "HTTP_X_SIGNATURE_HMAC_SHA256_HEX": signature,
            "HTTP_X_SIGNATURE_KEY_VARIANT": variant,
        }

        return self.client.post(
            "/extensions/cloudflare/webhook/", body, content_type="application/json", **headers
        )


class CloudflareWebhookTest(BaseWebhookTest):
    def test_missing_signature(self):
        resp = self.post_webhook({"event": "test"}, signature=None)
        assert resp.status_code == 400

    def test_invalid_signature(self):
        resp = self.post_webhook({"event": "test"}, signature="a" * 40)
        assert resp.status_code == 400

    def test_invalid_json(self):
        resp = self.post_webhook("a")
        assert resp.status_code == 400

    def test_missing_variant(self):
        resp = self.post_webhook({"event": "test"}, variant=None)
        assert resp.status_code == 400

    def test_invalid_variant(self):
        resp = self.post_webhook({"event": "test"}, variant="fizzbuz")
        assert resp.status_code == 400

    def test_invalid_signature_with_test_variant(self):
        resp = self.post_webhook({"event": "test"}, variant="test")
        assert resp.status_code == 400

    def test_invalid_app_id_test_variant(self):
        resp = self.post_webhook(
            {"event": "test", "app": {"id": "buzz"}}, variant="test", key="test-key"
        )
        assert resp.status_code == 400

    def test_valid_test_variant(self):
        resp = self.post_webhook(
            {"event": "test", "app": {"id": "local"}, "install": {}}, variant="test", key="test-key"
        )
        assert resp.status_code == 200


class PreviewWebhookTest(BaseWebhookTest):
    def test_empty(self):
        webhook_data = json.loads(self.load_fixture("cloudflare/preview-webhook.json"))
        resp = self.post_webhook(webhook_data)

        assert resp.status_code == 200, resp.content
        assert resp.data == {"install": webhook_data["install"], "proceed": True}

    def test_prefills_data(self):
        webhook_data = json.loads(
            self.load_fixture("cloudflare/preview-webhook-authenticated.json")
        )
        webhook_data["install"]["options"]["organization"] = six.text_type(self.org.id)
        resp = self.post_webhook(data=webhook_data)

        assert resp.status_code == 200, resp.content
        assert resp.data["proceed"]
        assert resp.data["install"]["schema"]["properties"]["organization"]["enum"] == [
            six.text_type(self.org.id)
        ]
        assert resp.data["install"]["schema"]["properties"]["organization"]["enumNames"] == {
            six.text_type(self.org.id): self.org.slug
        }
        assert resp.data["install"]["options"]["organization"] == six.text_type(self.org.id)
        assert resp.data["install"]["schema"]["properties"]["project"]["enum"] == [
            six.text_type(self.project.id)
        ]
        assert resp.data["install"]["schema"]["properties"]["project"]["enumNames"] == {
            six.text_type(self.project.id): self.project.slug
        }
        assert resp.data["install"]["options"]["project"] == six.text_type(self.project.id)
        assert resp.data["install"]["schema"]["properties"]["dsn"]["enum"] == [
            self.key.get_dsn(public=True)
        ]
        assert resp.data["install"]["options"]["dsn"] == six.text_type(
            self.key.get_dsn(public=True)
        )

    def test_multiple_projects(self):
        project2 = self.create_project(name="b", teams=[self.team])

        webhook_data = json.loads(
            self.load_fixture("cloudflare/preview-webhook-authenticated.json")
        )
        webhook_data["install"]["options"]["organization"] = six.text_type(self.org.id)
        resp = self.post_webhook(webhook_data)

        assert resp.status_code == 200, resp.content
        assert resp.data["proceed"]
        assert resp.data["install"]["schema"]["properties"]["organization"]["enum"] == [
            six.text_type(self.org.id)
        ]
        assert resp.data["install"]["options"]["organization"] == six.text_type(self.org.id)
        assert resp.data["install"]["schema"]["properties"]["project"]["enum"] == [
            six.text_type(self.project.id),
            six.text_type(project2.id),
        ]
        assert resp.data["install"]["options"]["project"] == six.text_type(self.project.id)
        assert resp.data["install"]["schema"]["properties"]["dsn"]["enum"] == [
            self.key.get_dsn(public=True)
        ]
        assert resp.data["install"]["options"]["dsn"] == six.text_type(
            self.key.get_dsn(public=True)
        )

    def test_no_projects(self):
        self.project.delete()

        webhook_data = json.loads(
            self.load_fixture("cloudflare/preview-webhook-authenticated.json")
        )
        webhook_data["install"]["options"]["organization"] = six.text_type(self.org.id)
        resp = self.post_webhook(webhook_data)

        assert resp.status_code == 200, resp.content
        assert resp.data["proceed"]
        assert resp.data["install"]["schema"]["properties"]["organization"]["enum"] == [
            six.text_type(self.org.id)
        ]
        assert resp.data["install"]["options"]["organization"] == six.text_type(self.org.id)
        assert resp.data["install"]["schema"]["properties"]["project"]["enum"] == []
        assert "dsn" not in resp.data["install"]["schema"]["properties"]


class OptionChangeAccountWebhookTest(BaseWebhookTest):
    def test_without_authentication(self):
        webhook_data = json.loads(
            self.load_fixture("cloudflare/option-change-account-webhook.json")
        )
        del webhook_data["authentications"]
        resp = self.post_webhook(webhook_data)

        assert resp.status_code == 401, resp.content

    def test_prefills_data(self):
        webhook_data = json.loads(
            self.load_fixture("cloudflare/option-change-account-webhook.json")
        )
        resp = self.post_webhook(webhook_data)

        assert resp.status_code == 200, resp.content
        assert resp.data["proceed"]
        assert resp.data["install"]["schema"]["properties"]["organization"]["enum"] == [
            six.text_type(self.org.id)
        ]
        assert resp.data["install"]["options"]["organization"] == six.text_type(self.org.id)
        assert resp.data["install"]["schema"]["properties"]["project"]["enum"] == [
            six.text_type(self.project.id)
        ]
        assert resp.data["install"]["options"]["project"] == six.text_type(self.project.id)
        assert resp.data["install"]["schema"]["properties"]["dsn"]["enum"] == [
            self.key.get_dsn(public=True)
        ]
        assert resp.data["install"]["options"]["dsn"] == six.text_type(
            self.key.get_dsn(public=True)
        )

    def test_with_invalid_organization_selected(self):
        webhook_data = json.loads(
            self.load_fixture("cloudflare/option-change-account-webhook.json")
        )
        webhook_data["install"]["options"]["organization"] = -1

        resp = self.post_webhook(webhook_data)

        assert resp.status_code == 200, resp.content
        assert resp.data["proceed"]
        assert resp.data["install"]["schema"]["properties"]["organization"]["enum"] == [
            six.text_type(self.org.id)
        ]
        assert resp.data["install"]["options"]["organization"] == six.text_type(self.org.id)
        assert resp.data["install"]["schema"]["properties"]["project"]["enum"] == [
            six.text_type(self.project.id)
        ]
        assert resp.data["install"]["options"]["project"] == six.text_type(self.project.id)
        assert resp.data["install"]["schema"]["properties"]["dsn"]["enum"] == [
            self.key.get_dsn(public=True)
        ]
        assert resp.data["install"]["options"]["dsn"] == six.text_type(
            self.key.get_dsn(public=True)
        )

    def test_with_existing_project_selected_and_no_keys(self):
        project2 = self.create_project(name="b", teams=[self.team])
        # kill the automatically generated keys
        ProjectKey.objects.filter(project=project2).delete()

        webhook_data = json.loads(
            self.load_fixture("cloudflare/option-change-account-webhook.json")
        )
        webhook_data["install"]["options"]["organization"] = six.text_type(self.org.id)
        webhook_data["install"]["options"]["project"] = six.text_type(project2.id)

        resp = self.post_webhook(webhook_data)

        assert resp.status_code == 200, resp.content
        assert resp.data["proceed"]
        assert resp.data["install"]["schema"]["properties"]["organization"]["enum"] == [
            six.text_type(self.org.id)
        ]
        assert resp.data["install"]["options"]["organization"] == six.text_type(self.org.id)
        assert resp.data["install"]["schema"]["properties"]["project"]["enum"] == [
            six.text_type(self.project.id),
            six.text_type(project2.id),
        ]
        assert resp.data["install"]["options"]["project"] == six.text_type(project2.id)
        assert resp.data["install"]["schema"]["properties"]["dsn"]["enum"] == []
        assert "dsn" not in resp.data["install"]["options"]

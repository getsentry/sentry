from unittest.mock import MagicMock, patch

from django.core import mail
from django.urls import reverse
from django.utils import timezone

from sentry.models.apitoken import ApiToken
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.silo import control_silo_test
from sentry.types.token import AuthTokenType
from sentry.utils import json
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token


@control_silo_test
class SecretScanningGitHubTest(TestCase):
    path = reverse("sentry-api-0-secret-scanning-github")

    def test_invalid_content_type(self) -> None:
        response = self.client.post(self.path, content_type="application/x-www-form-urlencoded")
        assert response.status_code == 400
        assert response.content == b'{"details":"invalid content type specified"}'

    def test_invalid_signature(self) -> None:
        response = self.client.post(self.path, content_type="application/json")
        assert response.status_code == 400
        assert response.content == b'{"details":"invalid signature"}'

    @override_options({"secret-scanning.github.enable-signature-verification": False})
    def test_false_positive(self) -> None:
        payload = [
            {
                "source": "commit",
                "token": "some_token",
                "type": "some_type",
                "url": "https://example.com/base-repo-url/",
            }
        ]
        response = self.client.post(self.path, content_type="application/json", data=payload)
        assert response.status_code == 200
        assert (
            response.content
            == b'[{"token_hash":"9a45520a1213f15016d2d768b5fb3d904492a44ee274b44d4de8803e00fb536a","token_type":"some_type","label":"false_positive"}]'
        )

    @override_options({"secret-scanning.github.enable-signature-verification": False})
    def test_false_positive_deactivated_personal_token(self) -> None:
        user = self.create_user()
        token = ApiToken.objects.create(user=user, name="test personal token", scope_list=[])

        # revoke token
        token.delete()

        payload = [
            {
                "source": "commit",
                "token": str(token),
                "type": "sentry_personal_token",
                "url": "https://example.com/base-repo-url/",
            }
        ]

        with self.tasks():
            response = self.client.post(self.path, content_type="application/json", data=payload)
        assert response.status_code == 200
        expected = [
            {
                "token_hash": hash_token(str(token)),
                "token_type": "sentry_personal_token",
                "label": "false_positive",
            }
        ]
        assert json.loads(response.content.decode("utf-8")) == expected

        assert len(mail.outbox) == 0

    @override_options({"secret-scanning.github.enable-signature-verification": False})
    def test_false_positive_deactivated_org_token(self) -> None:
        token_str = generate_token("test-org", "https://test-region.sentry.io")
        hash_digest = hash_token(token_str)
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="test org token",
            scope_list=["org:ci"],
            token_hashed=hash_digest,
        )

        # revoke token
        token.update(date_deactivated=timezone.now())

        payload = [
            {
                "source": "commit",
                "token": token_str,
                "type": "sentry_organization_token",
                "url": "https://example.com/base-repo-url/",
            }
        ]

        with self.tasks():
            response = self.client.post(self.path, content_type="application/json", data=payload)
        assert response.status_code == 200
        expected = [
            {
                "token_hash": hash_digest,
                "token_type": "sentry_organization_token",
                "label": "false_positive",
            }
        ]
        assert json.loads(response.content.decode("utf-8")) == expected

        assert len(mail.outbox) == 0

    @override_options(
        {
            "secret-scanning.github.enable-signature-verification": False,
        }
    )
    @patch("sentry.api.endpoints.secret_scanning.github.logger")
    def test_true_positive_personal_token(self, mock_logger: MagicMock) -> None:
        user = self.create_user(email="test@example.com")
        token = ApiToken.objects.create(user=user, name="test personal token", scope_list=[])
        hash_digest = hash_token(token.token)

        payload = [
            {
                "source": "commit",
                "token": str(token.token),
                "type": "sentry_personal_token",
                "url": "https://example.com/base-repo-url/",
            }
        ]

        with self.tasks():
            response = self.client.post(self.path, content_type="application/json", data=payload)
        assert response.status_code == 200
        expected = [
            {
                "token_hash": hash_digest,
                "token_type": "sentry_personal_token",
                "label": "true_positive",
            }
        ]
        assert json.loads(response.content.decode("utf-8")) == expected

        extra = {
            "exposed_source": "commit",
            "exposed_url": "https://example.com/base-repo-url/",
            "hashed_token": token.hashed_token,
            "token_type": AuthTokenType.USER,
        }
        mock_logger.info.assert_called_with("found an exposed auth token", extra=extra)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [user.email]
        assert mail.outbox[0].subject == "[Sentry]Action Required: Personal Token Exposed"
        assert (
            "Your Sentry Personal Token was found publicly on the internet" in mail.outbox[0].body
        )
        assert "http://testserver/settings/account/api/auth-tokens" in mail.outbox[0].body
        assert "test personal token" in mail.outbox[0].body
        assert token.hashed_token in mail.outbox[0].body

    @override_options(
        {
            "secret-scanning.github.enable-signature-verification": False,
        }
    )
    @patch("sentry.api.endpoints.secret_scanning.github.logger")
    def test_true_positive_org_token(self, mock_logger: MagicMock) -> None:
        self.user.email = "org-owner@example.com"
        self.user.save()

        token_str = generate_token("test-org", "https://test-region.sentry.io")
        hash_digest = hash_token(token_str)
        token = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="test org token",
            scope_list=["org:ci"],
            token_hashed=hash_digest,
        )

        payload = [
            {
                "source": "commit",
                "token": token_str,
                "type": "sentry_organization_token",
                "url": "https://example.com/base-repo-url/",
            }
        ]

        with self.tasks():
            response = self.client.post(self.path, content_type="application/json", data=payload)
        assert response.status_code == 200
        expected = [
            {
                "token_hash": hash_digest,
                "token_type": "sentry_organization_token",
                "label": "true_positive",
            }
        ]
        assert json.loads(response.content.decode("utf-8")) == expected

        extra = {
            "exposed_source": "commit",
            "exposed_url": "https://example.com/base-repo-url/",
            "hashed_token": token.token_hashed,
            "token_type": AuthTokenType.ORG,
        }
        mock_logger.info.assert_called_with("found an exposed auth token", extra=extra)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == [self.user.email]
        assert mail.outbox[0].subject == "[Sentry]Action Required: Organization Token Exposed"
        assert (
            "Your Sentry Organization Token was found publicly on the internet"
            in mail.outbox[0].body
        )
        assert "http://baz.testserver/settings/auth-tokens/" in mail.outbox[0].body
        assert "test org token" in mail.outbox[0].body
        assert token.token_hashed in mail.outbox[0].body

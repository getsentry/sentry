from __future__ import annotations

import hashlib
import hmac
from time import time
from typing import Any

import orjson

from sentry.integrations.gitea.integration import GiteaIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import assume_test_silo_mode

INSTANCE = "gitea.example.com"
BASE_URL = f"https://{INSTANCE}"
CLIENT_ID = "client-id"
# `{host}:{client_id}` - the OAuth app stands in for the installation identity
# Gitea has no concept of, so tenants of a shared host never collide.
EXTERNAL_ID = f"{INSTANCE}:{CLIENT_ID}"
WEBHOOK_SECRET = "secret-token-value"


def webhook_url(organization_id: int, integration_id: int) -> str:
    """The per-(organization, integration) endpoint a hook is registered at."""
    return f"/extensions/gitea/organizations/{organization_id}/webhook/{integration_id}/"


def webhook_token(organization_id: int, integration_id: int, secret: str = WEBHOOK_SECRET) -> str:
    """
    The HMAC key Gitea signs deliveries with. Never on the wire - the hook URL
    says who a delivery is for, and this authenticates that claim. Both route
    components are bound in so a body signed for one organization cannot be
    replayed at another's endpoint.
    """
    return f"{organization_id}:{integration_id}:{secret}"


REPO_ID = 15
REPO_PATH = "acme/widgets"


def gitea_signature(body: bytes, token: str) -> str:
    """The bare-hex HMAC-SHA256 Gitea puts in ``X-Gitea-Signature``."""
    return hmac.new(token.encode("utf-8"), body, hashlib.sha256).hexdigest()


def repository_payload(
    repo_id: int = REPO_ID,
    full_name: str = REPO_PATH,
    html_url: str | None = None,
) -> dict[str, Any]:
    return {
        "id": repo_id,
        "name": full_name.split("/")[-1],
        "full_name": full_name,
        "html_url": html_url or f"{BASE_URL}/{full_name}",
        "default_branch": "main",
    }


def push_event(
    commits: list[dict[str, Any]] | None = None,
    repo_id: int = REPO_ID,
) -> bytes:
    if commits is None:
        commits = [
            {
                "id": "a" * 40,
                "message": "Fix the thing\n\nLonger body.",
                "url": f"{BASE_URL}/{REPO_PATH}/commit/{'a' * 40}",
                "author": {"name": "Dev Eloper", "email": "dev@example.com", "username": "dev"},
                "committer": {"name": "Dev Eloper", "email": "dev@example.com", "username": "dev"},
                "timestamp": "2026-08-01T10:00:00+00:00",
            },
            {
                "id": "b" * 40,
                "message": "Fix the other thing",
                "url": f"{BASE_URL}/{REPO_PATH}/commit/{'b' * 40}",
                "author": {"name": "Other Dev", "email": "other@example.com", "username": "other"},
                "committer": {
                    "name": "Other Dev",
                    "email": "other@example.com",
                    "username": "other",
                },
                "timestamp": "2026-08-01T11:00:00+00:00",
            },
        ]
    return orjson.dumps(
        {
            "ref": "refs/heads/main",
            "before": "0" * 40,
            "after": commits[-1]["id"] if commits else "0" * 40,
            "compare_url": f"{BASE_URL}/{REPO_PATH}/compare/main",
            "commits": commits,
            "total_commits": len(commits),
            "repository": repository_payload(repo_id=repo_id),
            "pusher": {"id": 7, "login": "dev", "email": "dev@example.com"},
            "sender": {"id": 7, "login": "dev", "email": "dev@example.com"},
        }
    )


def pull_request_event(
    action: str = "opened",
    state: str = "open",
    merged: bool = False,
    repo_id: int = REPO_ID,
    **pull_request: Any,
) -> bytes:
    payload = {
        "id": 900,
        "number": 4,
        "title": "Fix the thing",
        "body": "This fixes the thing.",
        "state": state,
        "merged": merged,
        "draft": False,
        "user": {
            "id": 7,
            "login": "dev",
            "full_name": "Dev Eloper",
            "email": "dev@example.com",
        },
        "head": {"sha": "c" * 40, "ref": "fix-the-thing"},
        "base": {"sha": "d" * 40, "ref": "main"},
        "merge_commit_sha": None,
        "created_at": "2026-08-01T10:00:00Z",
        "updated_at": "2026-08-01T12:00:00Z",
        "closed_at": None,
        "merged_at": None,
    }
    payload.update(pull_request)
    return orjson.dumps(
        {
            "action": action,
            "number": payload["number"],
            "pull_request": payload,
            "repository": repository_payload(repo_id=repo_id),
            "sender": {"id": 7, "login": "dev", "email": "dev@example.com"},
        }
    )


class GiteaTestCase(APITestCase):
    provider = IntegrationProviderSlug.GITEA.value

    def setUp(self) -> None:
        self.login_as(self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_provider_integration(
                provider=self.provider,
                name=INSTANCE,
                external_id=EXTERNAL_ID,
                metadata={
                    "instance": INSTANCE,
                    "domain_name": INSTANCE,
                    "base_url": BASE_URL,
                    "verify_ssl": True,
                    "webhook_secret": WEBHOOK_SECRET,
                    "scopes": ["read:repository", "read:user", "write:issue", "write:repository"],
                    "instance_version": "1.27.1",
                },
            )
            identity = self.create_identity(
                identity_provider=self.create_identity_provider(type=self.provider, config={}),
                user=self.user,
                external_id=f"{INSTANCE}:7",
                data={
                    "access_token": "123456789",
                    "created_at": time(),
                    "refresh_token": "0987654321",
                    "client_id": CLIENT_ID,
                    "client_secret": "client-secret",
                },
            )
            self.integration.add_organization(self.organization, self.user, identity.id)
        self.installation = get_installation_of_type(
            GiteaIntegration, self.integration, self.organization.id
        )
        # Both depend on ids that only exist once the rows above are created.
        self.webhook_url = webhook_url(self.organization.id, self.integration.id)
        self.webhook_token = webhook_token(self.organization.id, self.integration.id)

    @assume_test_silo_mode(SiloMode.CELL)
    def create_gitea_repo(
        self,
        name: str = REPO_PATH,
        external_id: int = REPO_ID,
        url: str | None = None,
        integration_id: int | None = None,
    ) -> Repository:
        instance = self.integration.metadata["instance"]
        repo = self.create_repo(
            project=self.project,
            name=name,
            provider=f"integrations:{IntegrationProviderSlug.GITEA.value}",
            integration_id=integration_id or self.integration.id,
            url=url or f"{BASE_URL}/{name}",
            external_id=f"{instance}:{external_id}",
        )
        repo.update(config={"path": name, "instance": instance})
        return repo

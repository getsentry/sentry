from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

from fixtures.bitbucket import PUSH_EVENT_EXAMPLE
from sentry.integrations.bitbucket.webhook import PROVIDER_NAME
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from tests.sentry.integrations.utils.test_assert_metrics import (
    assert_failure_metric,
    assert_success_metric,
)

BAD_IP = "109.111.111.10"
BITBUCKET_IP_IN_RANGE = "104.192.143.10"
BITBUCKET_IP = "34.198.178.64"


class WebhookBaseTest(APITestCase):
    endpoint = "sentry-extensions-bitbucket-webhook"

    def setUp(self):
        super().setUp()
        project = self.project  # force creation
        self.organization_id = project.organization.id

    def send_webhook(self) -> None:
        self.get_success_response(
            self.organization_id,
            raw_data=PUSH_EVENT_EXAMPLE,
            extra_headers=dict(
                HTTP_X_EVENT_KEY="repo:push",
                REMOTE_ADDR=BITBUCKET_IP,
            ),
            status_code=204,
        )

    def assert_commit(self) -> None:
        commit_list = list(
            Commit.objects.filter(organization_id=self.organization_id)
            .select_related("author")
            .order_by("-date_added")
        )

        assert len(commit_list) == 1

        commit = commit_list[0]

        assert commit.key == "e0e377d186e4f0e937bdb487a23384fe002df649"
        assert commit.message == "README.md edited online with Bitbucket"
        assert commit.author is not None
        assert commit.author.name == "Max Bittker"
        assert commit.author.email == "max@getsentry.com"
        assert commit.author.external_id is None
        assert commit.date_added == datetime(2017, 5, 24, 1, 5, 47, tzinfo=timezone.utc)

    def create_repository(self, **kwargs: Any) -> Repository:
        return Repository.objects.create(
            **{
                **dict(
                    organization_id=self.organization_id,
                    external_id="{c78dfb25-7882-4550-97b1-4e0d38f32859}",
                    provider=PROVIDER_NAME,
                    name="maxbittker/newsdiffs",
                ),
                **kwargs,
            }
        )


class WebhookGetTest(WebhookBaseTest):
    def test_get_request_fails(self):
        self.get_error_response(self.organization_id, status_code=405)


class WebhookTest(WebhookBaseTest):
    method = "post"

    def test_unregistered_event(self):
        self.get_success_response(
            self.organization_id,
            raw_data=PUSH_EVENT_EXAMPLE,
            extra_headers=dict(
                HTTP_X_EVENT_KEY="UnregisteredEvent",
                REMOTE_ADDR=BITBUCKET_IP,
            ),
            status_code=204,
        )
        self.get_success_response(
            self.organization_id,
            raw_data=PUSH_EVENT_EXAMPLE,
            extra_headers=dict(
                HTTP_X_EVENT_KEY="UnregisteredEvent",
                REMOTE_ADDR=BITBUCKET_IP_IN_RANGE,
            ),
            status_code=204,
        )

    def test_invalid_signature_ip(self):
        self.get_error_response(
            self.organization_id,
            raw_data=PUSH_EVENT_EXAMPLE,
            extra_headers=dict(
                HTTP_X_EVENT_KEY="repo:push",
                REMOTE_ADDR=BAD_IP,
            ),
            status_code=401,
        )


class PushEventWebhookTest(WebhookBaseTest):
    method = "post"

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_simple(self, mock_record):
        self.create_repository()

        self.send_webhook()
        self.assert_commit()

        assert_success_metric(mock_record)

    @patch("sentry.integrations.bitbucket.webhook.PushEventWebhook.__call__")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_webhook_error_metric(self, mock_record, mock_event):
        self.create_repository()

        error = Exception("error")
        mock_event.side_effect = error

        self.get_error_response(
            self.organization_id,
            raw_data=PUSH_EVENT_EXAMPLE,
            extra_headers=dict(
                HTTP_X_EVENT_KEY="repo:push",
                REMOTE_ADDR=BITBUCKET_IP,
            ),
            status_code=500,
        )

        assert_failure_metric(mock_record, error)

    def test_anonymous_lookup(self):
        self.create_repository()

        CommitAuthor.objects.create(
            external_id="bitbucket:baxterthehacker",
            organization_id=self.project.organization_id,
            email="baxterthehacker@example.com",
            name="baxterthehacker",
        )

        self.send_webhook()
        # should be skipping the #skipsentry commit
        self.assert_commit()

    def test_update_repo_name(self):
        repo_out_of_date_name = self.create_repository(
            name="maxbittker/newssames",  # out of date
            url="https://bitbucket.org/maxbittker/newsdiffs",
            config={"name": "maxbittker/newsdiffs"},
        )

        self.send_webhook()

        # name has been updated
        repo_out_of_date_name.refresh_from_db()
        assert repo_out_of_date_name.name == "maxbittker/newsdiffs"

    def test_update_repo_config_name(self):
        repo_out_of_date_config_name = self.create_repository(
            name="maxbittker/newsdiffs",
            url="https://bitbucket.org/maxbittker/newsdiffs",
            config={"name": "maxbittker/newssames"},  # out of date
        )
        self.send_webhook()

        # config name has been updated
        repo_out_of_date_config_name.refresh_from_db()
        assert repo_out_of_date_config_name.config["name"] == "maxbittker/newsdiffs"

    def test_update_repo_url(self):
        repo_out_of_date_url = self.create_repository(
            name="maxbittker/newsdiffs",
            url="https://bitbucket.org/maxbittker/newssames",  # out of date
            config={"name": "maxbittker/newsdiffs"},
        )

        self.send_webhook()

        # url has been updated
        repo_out_of_date_url.refresh_from_db()
        assert repo_out_of_date_url.url == "https://bitbucket.org/maxbittker/newsdiffs"

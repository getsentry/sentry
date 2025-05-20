from __future__ import annotations

import logging

import sentry_sdk
from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.integrations.jira.webhooks.base import JiraWebhookBase
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.utils.atlassian_connect import get_integration_from_jwt
from sentry.integrations.utils.scope import bind_org_context_from_integration
from sentry.models.grouplink import GroupLink

logger = logging.getLogger(__name__)


@region_silo_endpoint
class JiraIssueDeletedWebhook(JiraWebhookBase):

    def post(self, request: Request, *args, **kwargs) -> Response:
        token = self.get_token(request)
        rpc_integration = get_integration_from_jwt(
            token=token,
            path=request.path,
            provider=self.provider,
            query_params=request.GET,
            method="POST",
        )
        # Integrations and their corresponding RpcIntegrations share the same id,
        # so we don't need to first convert this to a full Integration object
        bind_org_context_from_integration(rpc_integration.id, {"webhook": "issue_deleted"})
        sentry_sdk.set_tag("integration_id", rpc_integration.id)

        data = request.data

        if (external_issue_key := data.get("issue", {}).get("key")) is None:
            logger.info("jira.missing-issue-key")
            return self.respond()

        try:
            # The given Jira issue may not have been linked to a Sentry issue
            external_issue = ExternalIssue.objects.get(
                integration_id=rpc_integration.id, key=external_issue_key
            )
        except ExternalIssue.DoesNotExist:
            return self.respond()

        # The jira issue no longer exists so all links should be severed
        with transaction.atomic(router.db_for_write(GroupLink)):
            GroupLink.objects.filter(linked_id=external_issue.id).delete()
            external_issue.delete()
        return self.respond()

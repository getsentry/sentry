from __future__ import absolute_import
import logging

from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint

from sentry.integrations.atlassian_connect import AtlassianConnectValidationError, get_integration_from_jwt
from sentry.models import sync_group_assignee_inbound

logger = logging.getLogger('sentry.integrations.jira.webhooks')


class JiraIssueUpdatedWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(JiraIssueUpdatedWebhook, self).dispatch(request, *args, **kwargs)

    def handle_assignee_change(self, integration, data):
        assignee = data['issue']['fields']['assignee']
        issue_key = data['issue']['key']

        if assignee is None:
            sync_group_assignee_inbound(
                integration, None, issue_key, assign=False,
            )
        else:
            sync_group_assignee_inbound(
                integration, assignee['emailAddress'], issue_key, assign=True,
            )

    def handle_status_change(self, integration, data):
        issue_key = data['issue']['key']

        try:
            changelog = next(
                item for item in data['changelog']['items'] if item['field'] == 'status'
            )
        except StopIteration:
            logger.info(
                'missing-changelog', extra={
                    'issue_key': issue_key,
                    'integration_id': integration.id,
                }
            )
            return

        for org_id in integration.organizations.values_list('id', flat=True):
            installation = integration.get_installation(org_id)

            installation.sync_status_inbound(issue_key, {
                'changelog': changelog,
                'issue': data['issue'],
            })

    def post(self, request, *args, **kwargs):
        try:
            token = request.META['HTTP_AUTHORIZATION'].split(' ', 1)[1]
        except (KeyError, IndexError):
            return self.respond(status=400)

        data = request.DATA

        assignee_changed = any(
            item for item in data['changelog']['items'] if item['field'] == 'assignee'
        )

        status_changed = any(
            item for item in data['changelog']['items'] if item['field'] == 'status'
        )

        if assignee_changed or status_changed:
            try:
                integration = get_integration_from_jwt(
                    token, request.path, request.GET, method='POST'
                )
            except AtlassianConnectValidationError:
                return self.respond(status=400)

            if assignee_changed:
                self.handle_assignee_change(integration, data)

            if status_changed:
                self.handle_status_change(integration, data)

        return self.respond()

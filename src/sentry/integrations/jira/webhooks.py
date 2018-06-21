from __future__ import absolute_import

from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint

from sentry.integrations.atlassian_connect import AtlassianConnectValidationError, get_integration_from_jwt
from sentry.models import sync_group_assignee_inbound


class JiraIssueUpdatedWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(JiraIssueUpdatedWebhook, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        try:
            token = request.META['HTTP_AUTHORIZATION'].split(' ', 1)[1]
        except (KeyError, IndexError):
            return self.respond(status=400)

        data = request.DATA

        assignee_changed = any(
            item for item in data['changelog']['items'] if item['field'] == 'assignee'
        )

        if not assignee_changed:
            return self.respond()

        try:
            integration = get_integration_from_jwt(
                token, request.path, request.GET, method='POST'
            )
        except AtlassianConnectValidationError:
            return self.respond(status=400)

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

        return self.respond()

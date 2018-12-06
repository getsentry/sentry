from __future__ import absolute_import

import jwt
import logging
import six
from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.integrations.jira.webhooks import (
    handle_assignee_change,
    handle_status_change
)
from sentry.models import Integration


logger = logging.getLogger('sentry.integrations.jiraserver.webhooks')


def get_integration_from_token(token):
    """
    When we create a jira server integration we create a webhook that contains
    a JWT in the URL. We use that JWT to locate the matching sentry integration later
    as Jira doesn't have any additional fields we can embed information in.
    """
    if not token:
        raise ValueError('Token was empty')

    try:
        unvalidated = jwt.decode(token, verify=False)
    except jwt.DecodeError:
        raise ValueError('Could not decode JWT token')
    if 'id' not in unvalidated:
        raise ValueError('Token did not contain `id`')
    try:
        integration = Integration.objects.get(
            provider='jira_server',
            external_id=unvalidated['id'])
    except Integration.DoesNotExist:
        raise ValueError('Could not find integration for token')
    try:
        jwt.decode(token, integration.metadata['webhook_secret'])
    except Exception as err:
        raise ValueError('Could not validate JWT. Got %s' % err)

    return integration


class JiraIssueUpdatedWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(JiraIssueUpdatedWebhook, self).dispatch(request, *args, **kwargs)

    def post(self, request, token, *args, **kwargs):
        try:
            integration = get_integration_from_token(token)
        except ValueError as err:
            logger.info('token-validation-error', extra={
                'token': token,
                'error': six.text_type(err)
            })
            return self.respond(status=400)

        data = request.DATA

        if not data.get('changelog'):
            logger.info(
                'missing-changelog', extra={
                    'integration_id': integration.id,
                    'data': data,
                }
            )
            return self.respond()

        handle_assignee_change(integration, data)
        handle_status_change(integration, data)

        return self.respond()

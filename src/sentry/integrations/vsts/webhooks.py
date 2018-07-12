from __future__ import absolute_import
from .client import VstsApiClient

from sentry.models import Identity, Integration, sync_group_assignee_inbound
from sentry.api.base import Endpoint
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

import re
UNSET = object()
# Pull email from the string: u'lauryn <lauryn@sentry.io>'
EMAIL_PARSER = re.compile(r'<(.*)>')


class WorkItemWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get_client(self, identity, oauth_redirect_url):
        return VstsApiClient(identity, oauth_redirect_url)

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super(WorkItemWebhook, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        data = request.DATA
        if data['eventType'] == 'workitem.updated':
            integration = Integration.objects.get(
                provider='vsts',
                external_id=data['resourceContainers']['collection']['id'],
            )
            try:
                self.check_webhook_secret(request, integration)
            except AssertionError:
                return self.respond(status=401)
            self.handle_updated_workitem(data, integration)
        return self.respond()

    def check_webhook_secret(self, request, integration):
        assert integration.metadata['subscription_secret'] == request.HEADERS['shared_secret']

    def handle_updated_workitem(self, data, integration):
        external_issue_key = data['resource']['workItemId']
        assigned_to = data['resource']['fields'].get('System.AssignedTo')
        self.handle_assign_to(integration, external_issue_key, assigned_to)

    def handle_assign_to(self, integration, external_issue_key, assigned_to):
        if not assigned_to:
            return
        new_value = assigned_to.get('newValue')
        if new_value is not None:
            email = self.parse_email(new_value)
            assign = True
        else:
            email = None
            assign = False
        sync_group_assignee_inbound(
            integration=integration,
            email=email,
            external_issue_key=external_issue_key,
            assign=assign,
        )

    def parse_email(self, email):
        return EMAIL_PARSER.search(email).group(1)

    def create_subscription(self, instance, identity_data, oauth_redirect_url, external_id):
        client = self.get_client(Identity(data=identity_data), oauth_redirect_url)
        client.delete_all_subscriptions(instance)
        return client.create_subscription(instance, external_id)

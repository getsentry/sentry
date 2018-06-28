from __future__ import absolute_import
from .client import VstsApiClient
from sentry.models import Identity, Integration, sync_group_assignee_inbound
from sentry.api.base import Endpoint
from django.views.decorators.csrf import csrf_exempt

UNSET = object()


class VstsWebhook(Endpoint):
    def get_client(self, identity, oauth_redirect_url):
        return VstsApiClient(identity, oauth_redirect_url)


class WorkItemWebhook(VstsWebhook):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(WorkItemWebhook, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        data = request.DATA
        if data['eventType'] == 'workitem.updated':
            self.handle_updated_workitem(data)

    def handle_updated_workitem(self, data):
        external_issue_key = data['resource']['workItemId']
        assigned_to = data['resource']['fields'].get('System.AssignedTo')
        status_change = data['resource']['fields'].get('System.State')

        integration = Integration.objects.get(
            provider='vsts',
            external_id=data['account']['id'],
        )
        self.handle_assign_to(integration, external_issue_key, assigned_to)
        self.handle_status_change(integration, external_issue_key, status_change)

    def handle_assign_to(self, integration, external_issue_key, assigned_to):
        new_value = assigned_to.get('NewValue', UNSET)
        if new_value == UNSET:
            return
        assign = True if new_value is not None else False
        sync_group_assignee_inbound(
            integration=integration,
            email=new_value,
            external_issue_key=external_issue_key,
            assign=assign,
        )

    def handle_status_change(self, integration, external_issue_key, status_change):
        new_value = status_change.get('NewValue', UNSET)
        if new_value == UNSET:
            return
        raise NotImplementedError

    def create_subscription(self, instance, identity_data, oauth_redirect_url, external_id):
        client = self.get_client(Identity(identity_data), oauth_redirect_url)
        return client.create_subscription(instance, external_id)

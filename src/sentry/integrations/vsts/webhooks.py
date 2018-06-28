from __future__ import absolute_import
from .client import VstsApiClient

from sentry.models import Identity, Integration, OrganizationIntegration, sync_group_assignee_inbound
from sentry.api.base import Endpoint
# from django.views.decorators.csrf import csrf_exempt

UNSET = object()


class WorkItemWebhook(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def get_client(self, identity, oauth_redirect_url):
        return VstsApiClient(identity, oauth_redirect_url)

    # @csrf_exempt
    # def dispatch(self, request, *args, **kwargs):
    #     import pdb; pdb.set_trace()
    #     return super(WorkItemWebhook, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        data = request.DATA
        if data['eventType'] == 'workitem.updated':
            self.handle_updated_workitem(data)
        return self.respond()

    def handle_updated_workitem(self, data):
        external_issue_key = data['resource']['workItemId']
        assigned_to = data['resource']['fields'].get('System.AssignedTo')
        status_change = data['resource']['fields'].get('System.State')

        integration = Integration.objects.get(
            provider='vsts',
            external_id=data['resourceContainers']['account']['id'],
        )
        self.handle_assign_to(integration, external_issue_key, assigned_to)
        self.handle_status_change(integration, external_issue_key, status_change)

    def handle_assign_to(self, integration, external_issue_key, assigned_to):
        new_value = assigned_to.get('newValue', UNSET)
        if new_value == UNSET:
            return
        user = self.find_user_by_display_name(new_value, integration)
        if user is None:
            self.logger.info(
                'vsts.assignee-not-found',
                extra={
                    'integration_id': integration.id,
                    'user_display_name': new_value,
                    'issue_key': external_issue_key,
                }
            )
            return
        assign = True if new_value is not None else False
        sync_group_assignee_inbound(
            integration=integration,
            email=user['mailAddress'],
            external_issue_key=external_issue_key,
            assign=assign,
        )
        return
        # Can't find user by display name

    def find_user_by_display_name(self, display_name, integration):
        from sentry.integrations.vsts.integration import VstsIntegrationProvider
        # TODO(lb): I need to talk to Microsoft because display names are not unique
        # but they are the only thing given!
        identity = Identity.objects.get(
            id=OrganizationIntegration.objects.filter(
                integration_id=integration.id
            ).values_list('default_auth_id', flat=True)[0]  # any default idenity will do
        )
        client = self.get_client(identity, VstsIntegrationProvider.oauth_redirect_url)
        users = client.get_users(integration.metadata['domain_name'])
        display_name = display_name.lower()
        for user in users['value']:
            if user['displayName'].lower() == display_name:
                return user
        return None

    def handle_status_change(self, integration, external_issue_key, status_change):
        new_value = status_change.get('newValue', UNSET)
        if new_value == UNSET:
            return
        raise NotImplementedError

    def create_subscription(self, instance, identity_data, oauth_redirect_url, external_id):
        client = self.get_client(Identity(data=identity_data), oauth_redirect_url)
        return client.create_subscription(instance, external_id)

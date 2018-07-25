from __future__ import absolute_import
from .client import VstsApiClient

from sentry.models import Group, Identity, Integration, OrganizationIntegration, sync_group_assignee_inbound
from sentry.api.base import Endpoint
from sentry.app import raven
from uuid import uuid4
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

    @csrf_exempt
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
                raven.captureException(request=request)
                return self.respond(status=401)
            self.handle_updated_workitem(data, integration)
        return self.respond()

    def check_webhook_secret(self, request, integration):
        assert integration.metadata['subscription']['secret'] == request.META['HTTP_SHARED_SECRET']

    def handle_updated_workitem(self, data):
        external_issue_key = data['resource']['workItemId']
        assigned_to = data['resource']['fields'].get('System.AssignedTo')
        status_change = data['resource']['fields'].get('System.State')
        integration = Integration.objects.get(
            provider='vsts',
            external_id=data['resourceContainers']['collection']['id'],
        )
        affected_groups = self.get_affected_groups(external_issue_key)
        project = data['resourceContainers']['project']['id']
        self.handle_assign_to(integration, external_issue_key, assigned_to, affected_groups)
        self.handle_status_change(
            integration,
            external_issue_key,
            status_change,
            affected_groups,
            project)

    def handle_assign_to(self, integration, external_issue_key, assigned_to, affected_groups):
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

    def handle_status_change(self, integration, external_issue_key,
                             status_change, affected_groups, project):
        new_status = status_change.get('newValue')
        old_status = status_change.get('oldValue')
        organization_ids = OrganizationIntegration.objects.filter(
            integration_id=integration.id,
        ).values_list('id', flat=True)
        states = None
        for organization_id in organization_ids:
            installation = integration.get_installation(organization_id)
            if states is None:
                # states should be the same throughout
                states = installation.get_client().get_work_item_states(
                    installation.instance, project)['value']
            groups = [g for g in affected_groups if g.project.organization_id == organization_id]
            data = {
                'new_status': new_status,
                'old_status': old_status,
                'groups': groups,
                'states': states,
            }
            installation.sync_status_inbound(external_issue_key, data)

    def parse_email(self, email):
        return EMAIL_PARSER.search(email).group(1)

    def create_subscription(self, instance, identity_data, oauth_redirect_url, external_id):
        client = self.get_client(Identity(data=identity_data), oauth_redirect_url)
        shared_secret = self.create_webhook_secret()
        return client.create_subscription(instance, external_id, shared_secret), shared_secret

    def create_webhook_secret(self):
        # following this example
        # https://github.com/getsentry/sentry-plugins/blob/master/src/sentry_plugins/github/plugin.py#L305
        return uuid4().hex + uuid4().hex

    def get_affected_groups(self, external_issue_key):
        affected_groups = list(
            Group.objects.get_groups_by_external_issue(
                self.model, external_issue_key,
            ).select_related('project'),
        )
        return affected_groups

from __future__ import absolute_import
from .client import VstsApiClient

from sentry.models import Identity, Integration, OrganizationIntegration, sync_group_assignee_inbound
from sentry.api.base import Endpoint
from sentry.app import raven
from uuid import uuid4
from django.views.decorators.csrf import csrf_exempt
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from rest_framework.response import Response
# from sentry.models import Integration
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

    def handle_updated_workitem(self, data, integration):
        external_issue_key = data['resource']['workItemId']
        assigned_to = data['resource']['fields'].get('System.AssignedTo')
        status_change = data['resource']['fields'].get('System.State')
        project = data['resourceContainers']['project']['id']
        self.handle_assign_to(integration, external_issue_key, assigned_to)
        self.handle_status_change(
            integration,
            external_issue_key,
            status_change,
            project)

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

    def handle_status_change(self, integration, external_issue_key,
                             status_change, project):
        if status_change is None:
            return

        organization_ids = OrganizationIntegration.objects.filter(
            integration_id=integration.id,
        ).values_list('organization_id', flat=True)

        for organization_id in organization_ids:
            installation = integration.get_installation(organization_id)
            data = {
                'new_state': status_change['newValue'],
                'old_state': status_change['oldValue'],
                'project': project,
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


class VstsSearchEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

    def get(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(
                organizations=organization,
                id=integration_id,
                provider='vsts',
            )
        except Integration.DoesNotExist:
            return Response(status=404)

        field = request.GET.get('field')
        query = request.GET.get('query')
        if field is None:
            return Response({'detail': 'field is a required parameter'}, status=400)
        if not query:
            return Response({'detail': 'query is a required parameter'}, status=400)

        installation = integration.get_installation(organization.id)

        if field == 'externalIssue':
            if not query:
                return Response
            resp = installation.search_issues(query)
            return Response([{
                'label': '(%s) %s' % (i['id'], i['fields']['System.Title']),
                'value': i['id'],
            } for i in resp.get('issues', [])])

        # url = ?
        # client = installation.get_client()
        # try:
        #     autocomplete_response = client.get_cached(url)
        # except (ApiUnauthorized, ApiError):
        #     autocomplete_response = None
        # return Response(autocomplete_response)

    #  def view_autocomplete(self, request, group, **kwargs):
    #     field = request.GET.get('autocomplete_field')
    #     query = request.GET.get('autocomplete_query')
    #     if field != 'issue_id' or not query:
    #         return Response({'issue_id': []})

    #     repo = self.get_option('repo', group.project)
    #     client = self.get_client(request.user)

    #     try:
    #         response = client.search_issues(repo, query.encode('utf-8'))
    #     except Exception as e:
    #         return Response(
    #             {
    #                 'error_type': 'validation',
    #                 'errors': [{
    #                     '__all__': self.message_from_error(e)
    #                 }]
    #             },
    #             status=400
    #         )

    #     issues = [
    #         {
    #             'text': '(#%s) %s' % (i['local_id'], i['title']),
    #             'id': i['local_id']
    #         } for i in response.get('issues', [])
    #     ]

    #     return Response({field: issues})

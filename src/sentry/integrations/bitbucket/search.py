from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models import Integration


class BitbucketSearchEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

    def get(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(
                organizations=organization,
                id=integration_id,
                provider='bitbucket',
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
            repo = request.GET.get('repo')
            full_query = (u'title~"%s"' % (query)).encode('utf-8')
            resp = installation.get_client().search_issues(repo, full_query)
            return Response([{
                'label': '#{} {}'.format(i['id'], i['title']),
                'value': i['id']
            } for i in resp.get('values', [])])

        return Response(status=400)

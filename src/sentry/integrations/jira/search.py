from __future__ import absolute_import

from six.moves.urllib.parse import parse_qs, unquote_plus, urlencode, urlsplit, urlunsplit

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.integrations.exceptions import ApiError, ApiUnauthorized
from sentry.models import Integration


class JiraSearchEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

    def _get_formatted_user(self, user):
        display = '%s %s(%s)' % (
            user.get('displayName', user['name']),
            '- %s ' % user.get('emailAddress') if user.get('emailAddress') else '',
            user['name'],
        )
        return {
            'value': user['name'],
            'label': display,
        }

    def get(self, request, organization, integration_id):
        try:
            integration = Integration.objects.get(
                organizations=organization,
                id=integration_id,
                provider='jira',
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
                return Response([])
            resp = installation.search_issues(query)
            return Response([{
                'label': '(%s) %s' % (i['key'], i['fields']['summary']),
                'value': i['key']
            } for i in resp.get('issues', [])])

        jira_url = request.GET.get('jira_url')
        if jira_url:
            jira_url = unquote_plus(jira_url)
            parsed = list(urlsplit(jira_url))
            jira_query = parse_qs(parsed[3])

            jira_client = installation.get_client()

            is_user_api = '/rest/api/latest/user/' in jira_url

            is_user_picker = '/rest/api/1.0/users/picker' in jira_url

            if is_user_api:  # its the JSON version of the autocompleter
                is_xml = False
                jira_query['username'] = query.encode('utf8')
                jira_query.pop(
                    'issueKey', False
                )  # some reason Jira complains if this key is in the URL.
                jira_query['project'] = request.GET.get('project', '').encode('utf8')
            elif is_user_picker:
                is_xml = False
                # for whatever reason, the create meta api returns an
                # invalid path, so let's just use the correct, documented one here:
                # https://docs.atlassian.com/jira/REST/cloud/#api/2/user
                # also, only pass path so saved instance url will be used
                parsed[0] = ''
                parsed[1] = ''
                parsed[2] = '/rest/api/2/user/picker'
                jira_query['query'] = query.encode('utf8')
            else:  # its the stupid XML version of the API.
                is_xml = True
                jira_query['query'] = query.encode('utf8')
                if jira_query.get('fieldName'):
                    # for some reason its a list.
                    jira_query['fieldName'] = jira_query['fieldName'][0]

            parsed[3] = urlencode(jira_query)
            final_url = urlunsplit(parsed)

            try:
                autocomplete_response = jira_client.get_cached(final_url)
            except (ApiUnauthorized, ApiError):
                autocomplete_response = None

            users = []

            if autocomplete_response is not None:
                if is_user_picker:
                    autocomplete_response = autocomplete_response['users']

                if is_xml:
                    for userxml in autocomplete_response.xml.findAll("users"):
                        users.append(
                            {
                                'id': userxml.find('name').text,
                                'text': userxml.find('html').text
                            }
                        )
                else:
                    for user in autocomplete_response:
                        if user.get('name'):
                            users.append(self._get_formatted_user(user))

            # if Jira user doesn't have proper permission for user api,
            # try the assignee api instead
            if not users and is_user_api:
                try:
                    autocomplete_response = jira_client.search_users_for_project(
                        request.GET.get('project', ''),
                        jira_query.get('username'),
                    )
                except (ApiUnauthorized, ApiError):
                    return Response({'detail': 'Unable to fetch users from Jira'}, status=400)

                for user in autocomplete_response:
                    if user.get('name'):
                        users.append(self._get_formatted_user(user))

            return Response(users)

        # TODO(jess): handle other autocomplete urls
        return Response(status=400)

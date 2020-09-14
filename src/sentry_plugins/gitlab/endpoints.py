from __future__ import absolute_import

# from rest_framework.response import Response
# from sentry.exceptions import PluginError
# from sentry.plugins.bases.issue2 import IssueGroupActionEndpoint
# from six.moves.urllib.parse import urlencode

# class GitlabIssueSearchEndpoint(IssueGroupActionEndpoint):
#     def get(self, request, group, **kwargs):
#         field = request.GET.get('autocomplete_field')
#         query = request.GET.get('autocomplete_query')
#         if field != 'issue_id' or not query:
#             return Response({'issue_id': []})

#         repo = self.get_option('repo', group.project)
#         client = self.plugin.get_client(group.project)
#         response = client.search_issues(repo, query)

#         issues = [{
#             'text': '(#%s) %s' % (i['number'], i['title']),
#             'id': i['number']
#         } for i in response.get('items', [])]

#         return Response({field: issues})

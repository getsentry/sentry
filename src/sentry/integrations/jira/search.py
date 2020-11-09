from __future__ import absolute_import

import six
from rest_framework.response import Response

from sentry.api.bases.integration import IntegrationEndpoint
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized, IntegrationError
from sentry.models import Integration


class JiraSearchEndpoint(IntegrationEndpoint):
    provider = "jira"

    def _get_integration(self, organization, integration_id):
        return Integration.objects.get(
            organizations=organization, id=integration_id, provider=self.provider
        )

    def _get_formatted_user(self, id_field, user):
        # The name field can be blank in jira-cloud, and the id_field varies by
        # jira-cloud and jira-server
        name = user.get("name", "")
        email = user.get("emailAddress")

        display = "%s %s%s" % (
            user.get("displayName", name),
            "- %s " % email if email else "",
            "(%s)" % name if name else "",
        )
        return {"value": user[id_field], "label": display.strip()}

    def get(self, request, organization, integration_id):
        try:
            integration = self._get_integration(organization, integration_id)
        except Integration.DoesNotExist:
            return Response(status=404)

        field = request.GET.get("field")
        query = request.GET.get("query")
        if field is None:
            return Response({"detail": "field is a required parameter"}, status=400)
        if not query:
            return Response({"detail": "query is a required parameter"}, status=400)

        installation = integration.get_installation(organization.id)
        if field == "externalIssue":
            if not query:
                return Response([])
            try:
                resp = installation.search_issues(query)
            except IntegrationError as e:
                return Response({"detail": six.text_type(e)}, status=400)
            return Response(
                [
                    {"label": "(%s) %s" % (i["key"], i["fields"]["summary"]), "value": i["key"]}
                    for i in resp.get("issues", [])
                ]
            )

        if field in ("assignee", "reporter"):
            jira_client = installation.get_client()
            try:
                response = jira_client.search_users_for_project(
                    request.GET.get("project", ""), query
                )
            except (ApiUnauthorized, ApiError):
                return Response({"detail": "Unable to fetch users from Jira"}, status=400)

            user_id_field = jira_client.user_id_field()
            users = [
                self._get_formatted_user(user_id_field, user)
                for user in response
                if user_id_field in user
            ]
            return Response(users)

        # TODO(jess): handle other autocomplete urls
        return Response(status=400)

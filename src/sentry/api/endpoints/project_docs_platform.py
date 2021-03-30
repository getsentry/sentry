from django.core.urlresolvers import reverse
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import ProjectKey
from sentry.utils.http import absolute_uri
from sentry.utils.integrationdocs import load_doc


def replace_keys(html, project_key):
    if project_key is None:
        return html
    html = html.replace("___DSN___", project_key.dsn_private)
    html = html.replace("___PUBLIC_DSN___", project_key.dsn_public)
    html = html.replace("___PUBLIC_KEY___", project_key.public_key)
    html = html.replace("___SECRET_KEY___", project_key.secret_key)
    html = html.replace("___PROJECT_ID___", str(project_key.project_id))
    html = html.replace("___MINIDUMP_URL___", project_key.minidump_endpoint)
    html = html.replace("___UNREAL_URL___", project_key.unreal_endpoint)
    html = html.replace(
        "___RELAY_CDN_URL___",
        absolute_uri(reverse("sentry-js-sdk-loader", args=[project_key.public_key])),
    )

    # If we actually render this in the main UI we can also provide
    # extra information about the project (org slug and project slug)
    if "___PROJECT_NAME___" in html or "___ORG_NAME___" in html:
        project = project_key.project
        org = project.organization
        html = html.replace("___ORG_NAME___", str(org.slug))
        html = html.replace("___PROJECT_NAME___", str(project.slug))

    return html


class ProjectDocsPlatformEndpoint(ProjectEndpoint):
    def get(self, request, project, platform):
        data = load_doc(platform)
        if not data:
            raise ResourceDoesNotExist

        project_key = ProjectKey.get_default(project)

        return Response(
            {
                "id": data["id"],
                "name": data["name"],
                "html": replace_keys(data["html"], project_key),
                "link": data["link"],
            }
        )

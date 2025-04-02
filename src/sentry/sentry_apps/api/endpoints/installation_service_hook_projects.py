from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.projects.services.project.service import project_service
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.api.serializers.servicehookproject import ServiceHookProjectSerializer
from sentry.sentry_apps.services.hook import hook_service


@region_silo_endpoint
class SentryAppInstallationServiceHookProjectsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, installation) -> Response:
        hook_projects = hook_service.list_service_hook_projects(installation.id)

        return self.paginate(
            request=request,
            queryset=hook_projects,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, access=request.access, serializer=ServiceHookProjectSerializer()
            ),
        )

    def put(self, request: Request, installation) -> Response:

        try:
            projects = request.data.get("projects")
            assert projects
        except Exception:
            return Response(
                status=400,
                data={
                    "error": "Need at least one project in request data. To remove all project filters, use DELETE."
                },
            )

        # convert slugs to ids if needed
        project_ids = []
        for project in projects:
            try:
                project_obj = project_service.get_by_id(int(project))
            except Exception:
                project_obj = project_service.get_by_slug(
                    organization_id=installation.organization_id, slug=project
                )
            if project_obj:
                project_ids.append(project_obj.id)
            else:
                return Response(
                    status=400,
                    data={"error": f"Project '{project}' not found"},
                )

        hook_projects = hook_service.replace_service_hook_projects(installation.id, project_ids)

        return self.paginate(
            request=request,
            queryset=hook_projects,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, access=request.access, serializer=ServiceHookProjectSerializer()
            ),
        )

    def delete(self, request: Request, installation) -> Response:
        hook_service.delete_service_hook_projects(installation.id)
        return Response(status=204)

from typing import Any

import orjson
from django.http import HttpResponse, HttpResponseRedirect
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.organizations.absolute_url import generate_organization_url
from sentry.profiles.utils import get_from_profiling_service, proxy_profiling_service


class ProjectProfilingBaseEndpoint(ProjectEndpoint):
    owner = ApiOwner.PROFILING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }


@region_silo_endpoint
class ProjectProfilingProfileEndpoint(ProjectProfilingBaseEndpoint):
    def get(self, request: Request, project: Project, profile_id: str) -> HttpResponse:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)

        response = get_from_profiling_service(
            "GET",
            f"/organizations/{project.organization_id}/projects/{project.id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

        if response.status == 200:
            profile = orjson.loads(response.data)

            if "release" in profile:
                profile["release"] = get_release(project, profile["release"])
            else:
                # make sure to remove the version from the metadata
                # we're going to replace it with the release here
                version = profile.get("metadata", {}).pop("version")
                profile["metadata"]["release"] = get_release(project, version)

            return Response(profile)

        return HttpResponse(
            content=response.data,
            status=response.status,
            content_type=response.headers.get("Content-Type", "application/json"),
        )


def get_release(project: Project, version: str) -> Any:
    if not version:
        return None

    try:
        release = Release.objects.get(
            projects=project,
            organization_id=project.organization_id,
            version=version,
        )
        return serialize(release)
    except Release.DoesNotExist:
        return {"version": version}


@region_silo_endpoint
class ProjectProfilingRawProfileEndpoint(ProjectProfilingBaseEndpoint):
    def get(self, request: Request, project: Project, profile_id: str) -> HttpResponse:
        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)
        kwargs: dict[str, Any] = {
            "method": "GET",
            "path": f"/organizations/{project.organization_id}/projects/{project.id}/raw_profiles/{profile_id}",
        }
        return proxy_profiling_service(**kwargs)


class ProjectProfileEventSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    package = serializers.CharField(required=False)

    def validate(self, data):
        if "name" not in data and "package" in data:
            raise serializers.ValidationError("The package was specified with no name")

        if "name" in data:
            data["package"] = data.get("package", "")

        return data


@region_silo_endpoint
class ProjectProfilingEventEndpoint(ProjectProfilingBaseEndpoint):
    def convert_args(self, request: Request, *args, **kwargs):
        # disables the auto conversion of project slug inherited from the
        # project endpoint since this takes the project id instead of the slug
        return (args, kwargs)

    def get(self, request: Request, project_id, profile_id: str) -> HttpResponse:
        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            return HttpResponse(status=404)

        if not features.has("organizations:profiling", project.organization, actor=request.user):
            return Response(status=404)

        serializer = ProjectProfileEventSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        data = serializer.validated_data

        org_url = generate_organization_url(project.organization.slug)

        redirect_url = f"{org_url}/profiling/profile/{project.slug}/{profile_id}/flamechart/"

        if data:
            name = data["name"]
            package = data["package"]
            redirect_url = f"{redirect_url}?frameName={name}&framePackage={package}"

        return HttpResponseRedirect(redirect_url)

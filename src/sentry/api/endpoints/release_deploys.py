from django.db.models import F
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ParameterValidationError, ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.models import Deploy, Environment, Release, ReleaseProjectEnvironment
from sentry.signals import deploy_created


class DeploySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    environment = serializers.CharField(max_length=64)
    url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    dateStarted = serializers.DateTimeField(required=False, allow_null=True)
    dateFinished = serializers.DateTimeField(required=False, allow_null=True)
    projects = serializers.ListField(
        child=ProjectField(scope="project:read"), required=False, allow_empty=False
    )

    def validate_environment(self, value):
        if not Environment.is_valid_name(value):
            raise serializers.ValidationError("Invalid value for environment")
        return value


@region_silo_endpoint
class ReleaseDeploysEndpoint(OrganizationReleasesBaseEndpoint):
    def get(self, request: Request, organization, version) -> Response:
        """
        List a Release's Deploys
        ````````````````````````

        Return a list of deploys for a given release.

        :pparam string organization_slug: the organization short name
        :pparam string version: the version identifier of the release.
        """
        try:
            release = Release.objects.get(version=version, organization=organization)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        queryset = Deploy.objects.filter(organization_id=organization.id, release=release)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_finished",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request: Request, organization, version) -> Response:
        """
        Create a Deploy
        ```````````````

        Create a deploy for a given release.

        :pparam string organization_slug: the organization short name
        :pparam string version: the version identifier of the release.
        :param string environment: the environment you're deploying to
        :param string name: the optional name of the deploy
        :param list projects: the optional list of project slugs to
                        create a deploy within. If not provided, deploys
                        are created for all of the release's projects.
        :param url url: the optional url that points to the deploy
        :param datetime dateStarted: an optional date that indicates when
                                     the deploy started
        :param datetime dateFinished: an optional date that indicates when
                                      the deploy ended. If not provided, the
                                      current time is used.
        """
        try:
            release = Release.objects.get(version=version, organization=organization)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        serializer = DeploySerializer(
            data=request.data, context={"organization": organization, "access": request.access}
        )

        if serializer.is_valid():
            result = serializer.validated_data
            release_projects = list(release.projects.all())
            projects = result.get("projects", release_projects)
            invalid_projects = {project.slug for project in projects} - {
                project.slug for project in release_projects
            }
            if len(invalid_projects) > 0:
                raise ParameterValidationError(
                    f"Invalid projects ({', '.join(invalid_projects)}) for release {release.version}"
                )

            env = Environment.objects.get_or_create(
                name=result["environment"], organization_id=organization.id
            )[0]
            for project in projects:
                env.add_project(project)

            deploy = Deploy.objects.create(
                organization_id=organization.id,
                release=release,
                environment_id=env.id,
                date_finished=result.get("dateFinished", timezone.now()),
                date_started=result.get("dateStarted"),
                name=result.get("name"),
                url=result.get("url"),
            )
            deploy_created.send_robust(deploy=deploy, sender=self.__class__)

            # XXX(dcramer): this has a race for most recent deploy, but
            # should be unlikely to hit in the real world
            Release.objects.filter(id=release.id).update(
                total_deploys=F("total_deploys") + 1, last_deploy_id=deploy.id
            )

            for project in projects:
                ReleaseProjectEnvironment.objects.create_or_update(
                    release=release,
                    environment=env,
                    project=project,
                    values={"last_deploy_id": deploy.id},
                )

            Deploy.notify_if_ready(deploy.id)

            return Response(serialize(deploy, request.user), status=201)

        return Response(serializer.errors, status=400)

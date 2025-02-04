import logging

from django.db.models import F
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ParameterValidationError, ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.signals import deploy_created

logger = logging.getLogger(__name__)


class DeploySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    environment = serializers.CharField(max_length=64)
    url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    dateStarted = serializers.DateTimeField(required=False, allow_null=True)
    dateFinished = serializers.DateTimeField(required=False, allow_null=True)
    projects = serializers.ListField(
        child=ProjectField(scope="project:read", id_allowed=True), required=False, allow_empty=False
    )

    def validate_environment(self, value):
        if not Environment.is_valid_name(value):
            raise serializers.ValidationError("Invalid value for environment")
        return value


@region_silo_endpoint
class ReleaseDeploysEndpoint(OrganizationReleasesBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization, version) -> Response:
        """
        List a Release's Deploys
        ````````````````````````

        Returns a list of deploys based on the organization, version, and project.

        :pparam string organization_id_or_slug: the id or slug of the organization
        :pparam string version: the version identifier of the release.
        """
        try:
            release = Release.objects.get(version=version, organization=organization)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        release_project_envs = ReleaseProjectEnvironment.objects.select_related("release").filter(
            release__organization_id=organization.id,
            release__version=version,
        )

        projects = self.get_projects(request, organization)
        project_id = [p.id for p in projects]

        if project_id and project_id != "-1":
            release_project_envs = release_project_envs.filter(project_id__in=project_id)

        deploy_ids = release_project_envs.values_list("last_deploy_id", flat=True)
        queryset = Deploy.objects.filter(id__in=deploy_ids)

        return self.paginate(
            request=request,
            paginator_cls=OffsetPaginator,
            queryset=queryset,
            order_by="-date_finished",
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request: Request, organization, version) -> Response:
        """
        Create a Deploy
        ```````````````

        Create a deploy for a given release.

        :pparam string organization_id_or_slug: the id or slug of the organization
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
        logging_info = {
            "org_slug": organization.slug,
            "org_id": organization.id,
            "version": version,
        }

        try:
            release = Release.objects.get(version=version, organization=organization)
        except Release.DoesNotExist:
            logger.info(
                "create_release_deploy.release_not_found",
                extra=logging_info,
            )
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            # Logic here copied from `has_release_permission` (lightly edited for results to be more
            # human-readable)
            if request.user.is_authenticated:
                auth = f"user.id: {request.user.id}"
            elif request.auth is not None:
                auth = f"auth.entity_id: {request.auth.entity_id}"
            else:
                auth = None
            if auth is not None:
                logging_info.update({"auth": auth})
                logger.info(
                    "create_release_deploy.no_release_permission",
                    extra=logging_info,
                )
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

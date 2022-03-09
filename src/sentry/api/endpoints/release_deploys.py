from django.db.models import F
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Deploy, Environment, Release, ReleaseProjectEnvironment
from sentry.signals import deploy_created


class DeploySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False, allow_blank=True, allow_null=True)
    environment = serializers.CharField(max_length=64)
    url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    dateStarted = serializers.DateTimeField(required=False, allow_null=True)
    dateFinished = serializers.DateTimeField(required=False, allow_null=True)

    def validate_environment(self, value):
        if not Environment.is_valid_name(value):
            raise serializers.ValidationError("Invalid value for environment")
        return value


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

        serializer = DeploySerializer(data=request.data)

        if serializer.is_valid():
            projects = list(release.projects.all())
            result = serializer.validated_data

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
                ReleaseProjectEnvironment.objects.update_or_create(
                    release=release,
                    environment=env,
                    project=project,
                    defaults={"last_deploy_id": deploy.id},
                )

            Deploy.notify_if_ready(deploy.id)

            return Response(serialize(deploy, request.user), status=201)

        return Response(serializer.errors, status=400)

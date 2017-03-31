from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.utils import timezone

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.app import locks
from sentry.models import Activity, Deploy, Environment, Release
from sentry.utils.retries import TimedRetryPolicy


class DeploySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64, required=False)
    environment = serializers.CharField(max_length=64)
    url = serializers.URLField(required=False)
    dateStarted = serializers.DateTimeField(required=False)
    dateFinished = serializers.DateTimeField(required=False)


class ReleaseDeploysEndpoint(OrganizationReleasesBaseEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, organization, version):
        """
        List a Release's Deploys
        ````````````````````````

        Return a list of deploys for a given release.

        :pparam string organization_slug: the organization short name
        :pparam string version: the version identifier of the release.
        """
        try:
            release = Release.objects.get(
                version=version,
                organization=organization,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise PermissionDenied

        queryset = Deploy.objects.filter(
            organization_id=organization.id,
            release=release,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_finished',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request, organization, version):
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
            release = Release.objects.get(
                version=version,
                organization=organization,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise PermissionDenied

        serializer = DeploySerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object
            try:
                env = Environment.objects.get(
                    organization_id=organization.id,
                    name=result['environment'],
                )
            except Environment.DoesNotExist:
                # TODO(jess): clean up when changing unique constraint
                lock_key = Environment.get_lock_key(organization.id, result['environment'])
                lock = locks.get(lock_key, duration=5)
                with TimedRetryPolicy(10)(lock.acquire):
                    try:
                        env = Environment.objects.get(
                            organization_id=organization.id,
                            name=result['environment'],
                        )
                    except Environment.DoesNotExist:
                        env = Environment.objects.create(
                            organization_id=organization.id,
                            name=result['environment'],
                        )

            try:
                with transaction.atomic():
                    deploy, created = Deploy.objects.create(
                        organization_id=organization.id,
                        release=release,
                        environment_id=env.id,
                        date_finished=result.get('dateFinished', timezone.now()),
                        date_started=result.get('dateStarted'),
                        name=result.get('name'),
                        url=result.get('url'),
                    ), True
            except IntegrityError:
                deploy, created = Deploy.objects.get(
                    organization_id=organization.id,
                    release=release,
                    environment_id=env.id,
                ), False
                deploy.update(
                    date_finished=result.get('dateFinished', timezone.now()),
                    date_started=result.get('dateStarted'),
                )

            activity = None
            for project in release.projects.all():
                activity = Activity.objects.create(
                    type=Activity.DEPLOY,
                    project=project,
                    ident=release.version,
                    data={
                        'version': release.version,
                        'deploy_id': deploy.id,
                        'environment': env.name
                    },
                    datetime=deploy.date_finished,
                )
            # Somewhat hacky, only send notification for one
            # Deploy Activity record because it will cover all projects
            if activity is not None:
                activity.send_notification()

            # This is the closest status code that makes sense, and we want
            # a unique 2xx response code so people can understand when
            # behavior differs.
            #   208 Already Reported (WebDAV; RFC 5842)
            status = 201 if created else 208

            return Response(serialize(deploy, request.user), status=status)

        return Response(serializer.errors, status=400)

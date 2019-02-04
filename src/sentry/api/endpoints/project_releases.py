from __future__ import absolute_import

from django.db import IntegrityError, transaction

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.fields.user import UserField
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import CommitSerializer, ListField
from sentry.models import (
    Activity,
    CommitFileChange,
    Environment,
    Release,
)
from sentry.plugins.interfaces.releasehook import ReleaseHook
from sentry.constants import VERSION_LENGTH
from sentry.signals import release_created


class CommitPatchSetSerializer(serializers.Serializer):
    path = serializers.CharField(max_length=255)
    type = serializers.CharField(max_length=1)

    def validate_type(self, attrs, source):
        value = attrs[source]
        if not CommitFileChange.is_valid_type(value):
            raise serializers.ValidationError('Commit patch_set type %s is not supported.' % value)
        return attrs


class CommitSerializerWithPatchSet(CommitSerializer):
    patch_set = ListField(
        child=CommitPatchSetSerializer(
            required=False),
        required=False,
        allow_null=True)


class ReleaseSerializer(serializers.Serializer):
    version = serializers.CharField(max_length=VERSION_LENGTH, required=True)
    ref = serializers.CharField(max_length=VERSION_LENGTH, required=False)
    url = serializers.URLField(required=False)
    owner = UserField(required=False)
    dateReleased = serializers.DateTimeField(required=False)
    commits = ListField(
        child=CommitSerializerWithPatchSet(
            required=False),
        required=False,
        allow_null=True)

    def validate_version(self, attrs, source):
        value = attrs[source]
        if not Release.is_valid_version(value):
            raise serializers.ValidationError('Invalid value for release')
        return attrs


class ProjectReleasesEndpoint(ProjectEndpoint, EnvironmentMixin):
    permission_classes = (ProjectReleasePermission, )

    def get(self, request, project):
        """
        List a Project's Releases
        `````````````````````````

        Retrieve a list of releases for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     releases of.
        :qparam string query: this parameter can be used to create a
                              "starts with" filter for the version.
        """
        query = request.GET.get('query')
        try:
            environment = self._get_environment_from_request(
                request,
                project.organization_id,
            )
        except Environment.DoesNotExist:
            queryset = Release.objects.none()
            environment = None
        else:
            queryset = Release.objects.filter(
                projects=project, organization_id=project.organization_id
            ).select_related('owner')
            if environment is not None:
                queryset = queryset.filter(
                    releaseprojectenvironment__project=project,
                    releaseprojectenvironment__environment=environment,
                )

        if query:
            queryset = queryset.filter(
                version__icontains=query,
            )

        queryset = queryset.extra(select={
            'sort': 'COALESCE(date_released, date_added)',
        })

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-sort',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, request.user, project=project, environment=environment),
        )

    def post(self, request, project):
        """
        Create a New Release for a Project
        ``````````````````````````````````

        Create a new release and/or associate a project with a release.
        Release versions that are the same across multiple projects
        within an Organization will be treated as the same release in Sentry.

        Releases are used by Sentry to improve its error reporting abilities
        by correlating first seen events with the release that might have
        introduced the problem.

        Releases are also necessary for sourcemaps and other debug features
        that require manual upload for functioning well.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to create a
                                     release for.
        :param string version: a version identifier for this release.  Can
                               be a version number, a commit hash etc.
        :param string ref: an optional commit reference.  This is useful if
                           a tagged version has been provided.
        :param url url: a URL that points to the release.  This can be the
                        path to an online interface to the sourcecode
                        for instance.
        :param datetime dateReleased: an optional date that indicates when
                                      the release went live.  If not provided
                                      the current time is assumed.
        :auth: required
        """
        serializer = ReleaseSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            # release creation is idempotent to simplify user
            # experiences
            try:
                with transaction.atomic():
                    release, created = Release.objects.create(
                        organization_id=project.organization_id,
                        version=result['version'],
                        ref=result.get('ref'),
                        url=result.get('url'),
                        owner=result.get('owner'),
                        date_released=result.get('dateReleased'),
                    ), True
                was_released = False
            except IntegrityError:
                release, created = Release.objects.get(
                    organization_id=project.organization_id,
                    version=result['version'],
                ), False
                was_released = bool(release.date_released)
            else:
                release_created.send_robust(release=release, sender=self.__class__)

            created = release.add_project(project)

            commit_list = result.get('commits')
            if commit_list:
                hook = ReleaseHook(project)
                # TODO(dcramer): handle errors with release payloads
                hook.set_commits(release.version, commit_list)

            if (not was_released and release.date_released):
                Activity.objects.create(
                    type=Activity.RELEASE,
                    project=project,
                    ident=Activity.get_version_ident(result['version']),
                    data={'version': result['version']},
                    datetime=release.date_released,
                )

            if not created:
                # This is the closest status code that makes sense, and we want
                # a unique 2xx response code so people can understand when
                # behavior differs.
                #   208 Already Reported (WebDAV; RFC 5842)
                status = 208
            else:
                status = 201

            return Response(serialize(release, request.user), status=status)
        return Response(serializer.errors, status=400)

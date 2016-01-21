from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.fields.user import UserField
from sentry.api.serializers import serialize
from sentry.models import Activity, Release
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('CreateNewRelease')
def create_new_release_scenario(runner):
    runner.request(
        method='POST',
        path='/projects/%s/%s/releases/' % (
            runner.org.slug, runner.default_project.slug),
        data={
            'version': '2.0rc2',
            'ref': '6ba09a7c53235ee8a8fa5ee4c1ca8ca886e7fdbb',
        }
    )


@scenario('ListReleases')
def list_releases_scenario(runner):
    runner.request(
        method='GET',
        path='/projects/%s/%s/releases/' % (
            runner.org.slug, runner.default_project.slug)
    )


class ReleaseSerializer(serializers.Serializer):
    version = serializers.RegexField(r'[a-zA-Z0-9\-_\.]', max_length=64, required=True)
    ref = serializers.CharField(max_length=64, required=False)
    url = serializers.URLField(required=False)
    owner = UserField(required=False)
    dateStarted = serializers.DateTimeField(required=False)
    dateReleased = serializers.DateTimeField(required=False)


class ProjectReleasesEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES

    @attach_scenarios([list_releases_scenario])
    def get(self, request, project):
        """
        List a Project's Releases
        `````````````````````````

        Retrieve a list of releases for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     releases of.
        :qparam string query: this parameter can beu sed to create a
                              "starts with" filter for the version.
        """
        query = request.GET.get('query')

        queryset = Release.objects.filter(
            project=project,
        ).select_related('owner')

        if query:
            queryset = queryset.filter(
                version__istartswith=query,
            )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )

    @attach_scenarios([create_new_release_scenario])
    def post(self, request, project):
        """
        Create a New Release
        ````````````````````

        Create a new release for the given project.  Releases are used by
        Sentry to improve it's error reporting abilities by correlating
        first seen events with the release that might have introduced the
        problem.

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
        :param datetime dateStarted: an optional date that indicates when the
                                     release process started.
        :param datetime dateReleased: an optional date that indicates when
                                      the release went live.  If not provided
                                      the current time is assumed.
        :auth: required
        """
        serializer = ReleaseSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            with transaction.atomic():
                try:
                    release = Release.objects.create(
                        project=project,
                        version=result['version'],
                        ref=result.get('ref'),
                        url=result.get('url'),
                        owner=result.get('owner'),
                        date_started=result.get('dateStarted'),
                        date_released=result.get('dateReleased') or timezone.now(),
                    )
                except IntegrityError:
                    return Response({
                        'detail': 'Release with version already exists'
                    }, status=400)
                else:
                    Activity.objects.create(
                        type=Activity.RELEASE,
                        project=project,
                        ident=result['version'],
                        data={'version': result['version']},
                        datetime=release.date_released,
                    )

            return Response(serialize(release, request.user), status=201)
        return Response(serializer.errors, status=400)

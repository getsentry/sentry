from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import InvalidRepository, ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import (
    ListField,
    ReleaseSerializer,
    ReleaseHeadCommitSerializer,
    ReleaseHeadCommitSerializerDeprecated,
)
from sentry.models import Activity, Group, Release, ReleaseFile
from sentry.utils.apidocs import scenario, attach_scenarios

ERR_RELEASE_REFERENCED = "This release is referenced by active issues and cannot be removed."


@scenario("RetrieveOrganizationRelease")
def retrieve_organization_release_scenario(runner):
    runner.request(
        method="GET",
        path="/organizations/%s/releases/%s/" % (runner.org.slug, runner.default_release.version),
    )


@scenario("UpdateOrganizationRelease")
def update_organization_release_scenario(runner):
    release = runner.utils.create_release(runner.default_project, runner.me, version="3000")
    runner.request(
        method="PUT",
        path="/organization/%s/releases/%s/" % (runner.org.slug, release.version),
        data={
            "url": "https://vcshub.invalid/user/project/refs/deadbeef1337",
            "ref": "deadbeef1337",
        },
    )


class OrganizationReleaseSerializer(ReleaseSerializer):
    headCommits = ListField(
        child=ReleaseHeadCommitSerializerDeprecated(), required=False, allow_null=False
    )
    refs = ListField(child=ReleaseHeadCommitSerializer(), required=False, allow_null=False)


class OrganizationReleaseDetailsEndpoint(OrganizationReleasesBaseEndpoint):
    doc_section = DocSection.RELEASES

    @attach_scenarios([retrieve_organization_release_scenario])
    def get(self, request, organization, version):
        """
        Retrieve an Organization's Release
        ``````````````````````````````````

        Return details on an individual release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        return Response(serialize(release, request.user))

    @attach_scenarios([update_organization_release_scenario])
    def put(self, request, organization, version):
        """
        Update an Organization's Release
        ````````````````````````````````

        Update a release. This can change some metadata associated with
        the release (the ref, url, and dates).

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :param string ref: an optional commit reference.  This is useful if
                           a tagged version has been provided.
        :param url url: a URL that points to the release.  This can be the
                        path to an online interface to the sourcecode
                        for instance.
        :param datetime dateReleased: an optional date that indicates when
                                      the release went live.  If not provided
                                      the current time is assumed.
        :param array commits: an optional list of commit data to be associated
                              with the release. Commits must include parameters
                              ``id`` (the sha of the commit), and can optionally
                              include ``repository``, ``message``, ``author_name``,
                              ``author_email``, and ``timestamp``.
        :param array refs: an optional way to indicate the start and end commits
                           for each repository included in a release. Head commits
                           must include parameters ``repository`` and ``commit``
                           (the HEAD sha). They can optionally include ``previousCommit``
                           (the sha of the HEAD of the previous release), which should
                           be specified if this is the first time you've sent commit data.
        :auth: required
        """
        try:
            release = Release.objects.get(organization_id=organization, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        serializer = OrganizationReleaseSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        was_released = bool(release.date_released)

        kwargs = {}
        if result.get("dateReleased"):
            kwargs["date_released"] = result["dateReleased"]
        if result.get("ref"):
            kwargs["ref"] = result["ref"]
        if result.get("url"):
            kwargs["url"] = result["url"]

        if kwargs:
            release.update(**kwargs)

        commit_list = result.get("commits")
        if commit_list:
            # TODO(dcramer): handle errors with release payloads
            release.set_commits(commit_list)

        refs = result.get("refs")
        if not refs:
            refs = [
                {
                    "repository": r["repository"],
                    "previousCommit": r.get("previousId"),
                    "commit": r["currentId"],
                }
                for r in result.get("headCommits", [])
            ]
        if refs:
            if not request.user.is_authenticated():
                return Response(
                    {"refs": ["You must use an authenticated API token to fetch refs"]}, status=400
                )
            fetch_commits = not commit_list
            try:
                release.set_refs(refs, request.user, fetch=fetch_commits)
            except InvalidRepository as exc:
                return Response({"refs": [exc.message]}, status=400)

        if not was_released and release.date_released:
            for project in release.projects.all():
                Activity.objects.create(
                    type=Activity.RELEASE,
                    project=project,
                    ident=Activity.get_version_ident(release.version),
                    data={"version": release.version},
                    datetime=release.date_released,
                )

        return Response(serialize(release, request.user))

    def delete(self, request, organization, version):
        """
        Delete an Organization's Release
        ````````````````````````````````

        Permanently remove a release and all of its files.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        # we don't want to remove the first_release metadata on the Group, and
        # while people might want to kill a release (maybe to remove files),
        # removing the release is prevented
        if Group.objects.filter(first_release=release).exists():
            return Response({"detail": ERR_RELEASE_REFERENCED}, status=400)

        # TODO(dcramer): this needs to happen in the queue as it could be a long
        # and expensive operation
        file_list = ReleaseFile.objects.filter(release=release).select_related("file")
        for releasefile in file_list:
            releasefile.file.delete()
            releasefile.delete()
        release.delete()

        return Response(status=204)

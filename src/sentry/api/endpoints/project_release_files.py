from __future__ import absolute_import

import re
import logging
from django.db import IntegrityError, transaction
from six import BytesIO
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.endpoints.organization_release_files import load_dist
from sentry.constants import MAX_RELEASE_FILES_OFFSET
from sentry.models import File, Release, ReleaseFile
from sentry.utils.apidocs import scenario, attach_scenarios

ERR_FILE_EXISTS = "A file matching this name already exists for the given release"
_filename_re = re.compile(r"[\n\t\r\f\v\\]")


@scenario("UploadReleaseFile")
def upload_file_scenario(runner):
    runner.request(
        method="POST",
        path="/projects/%s/%s/releases/%s/files/"
        % (runner.org.slug, runner.default_project.slug, runner.default_release.version),
        data={
            "header": "Content-Type:text/plain; encoding=utf-8",
            "name": "/demo/hello.py",
            "file": ("hello.py", BytesIO(b'print "Hello World!"')),
        },
        format="multipart",
    )


@scenario("ListReleaseFiles")
def list_files_scenario(runner):
    runner.utils.create_release_file(
        project=runner.default_project,
        release=runner.default_release,
        path="/demo/message-for-you.txt",
        contents="Hello World!",
    )
    runner.request(
        method="GET",
        path="/projects/%s/%s/releases/%s/files/"
        % (runner.org.slug, runner.default_project.slug, runner.default_release.version),
    )


class ProjectReleaseFilesEndpoint(ProjectEndpoint):
    doc_section = DocSection.RELEASES
    permission_classes = (ProjectReleasePermission,)

    @attach_scenarios([list_files_scenario])
    def get(self, request, project, version):
        """
        List a Project Release's Files
        ``````````````````````````````

        Retrieve a list of files for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     release files of.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        file_list = (
            ReleaseFile.objects.filter(release=release).select_related("file").order_by("name")
        )

        return self.paginate(
            request=request,
            queryset=file_list,
            order_by="name",
            paginator_cls=OffsetPaginator,
            max_offset=MAX_RELEASE_FILES_OFFSET,
            on_results=lambda r: serialize(load_dist(r), request.user),
        )

    @attach_scenarios([upload_file_scenario])
    def post(self, request, project, version):
        """
        Upload a New Project Release File
        `````````````````````````````````

        Upload a new file for the given release.

        Unlike other API requests, files must be uploaded using the
        traditional multipart/form-data content-type.

        The optional 'name' attribute should reflect the absolute path
        that this file will be referenced as. For example, in the case of
        JavaScript you might specify the full web URI.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to change the
                                     release of.
        :pparam string version: the version identifier of the release.
        :param string name: the name (full path) of the file.
        :param string dist: the name of the dist.
        :param file file: the multipart encoded file.
        :param string header: this parameter can be supplied multiple times
                              to attach headers to the file.  Each header
                              is a string in the format ``key:value``.  For
                              instance it can be used to define a content
                              type.
        :auth: required
        """
        try:
            release = Release.objects.get(
                organization_id=project.organization_id, projects=project, version=version
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        logger = logging.getLogger("sentry.files")
        logger.info("projectreleasefile.start")

        if "file" not in request.data:
            return Response({"detail": "Missing uploaded file"}, status=400)

        fileobj = request.data["file"]

        full_name = request.data.get("name", fileobj.name)
        if not full_name or full_name == "file":
            return Response({"detail": "File name must be specified"}, status=400)

        name = full_name.rsplit("/", 1)[-1]

        if _filename_re.search(name):
            return Response(
                {"detail": "File name must not contain special whitespace characters"}, status=400
            )

        dist_name = request.data.get("dist")
        dist = None
        if dist_name:
            dist = release.add_dist(dist_name)

        headers = {"Content-Type": fileobj.content_type}
        for headerval in request.data.getlist("header") or ():
            try:
                k, v = headerval.split(":", 1)
            except ValueError:
                return Response({"detail": "header value was not formatted correctly"}, status=400)
            else:
                if _filename_re.search(v):
                    return Response(
                        {"detail": "header value must not contain special whitespace characters"},
                        status=400,
                    )
                headers[k] = v.strip()

        file = File.objects.create(name=name, type="release.file", headers=headers)
        file.putfile(fileobj, logger=logger)

        try:
            with transaction.atomic():
                releasefile = ReleaseFile.objects.create(
                    organization_id=release.organization_id,
                    release=release,
                    file=file,
                    name=full_name,
                    dist=dist,
                )
        except IntegrityError:
            file.delete()
            return Response({"detail": ERR_FILE_EXISTS}, status=409)

        return Response(serialize(releasefile, request.user), status=201)

from __future__ import absolute_import

import six
import jsonschema
import logging
import posixpath

from django.db import transaction
from django.db.models import Q
from django.http import StreamingHttpResponse, HttpResponse, Http404
from rest_framework.response import Response
from symbolic import normalize_debug_id, SymbolicError

from sentry import ratelimits

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import KNOWN_DIF_FORMATS
from sentry.models import FileBlobOwner, ProjectDebugFile, create_files_from_dif_zip
from sentry.tasks.assemble import (
    get_assemble_status,
    set_assemble_status,
    AssembleTask,
    ChunkFileState,
)
from sentry.utils import json


logger = logging.getLogger("sentry.api")
ERR_FILE_EXISTS = "A file matching this debug identifier already exists"


def upload_from_request(request, project):
    if "file" not in request.data:
        return Response({"detail": "Missing uploaded file"}, status=400)
    fileobj = request.data["file"]
    files = create_files_from_dif_zip(fileobj, project=project)
    return Response(serialize(files, request.user), status=201)


class DebugFilesEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS
    permission_classes = (ProjectReleasePermission,)

    def download(self, debug_file_id, project):
        rate_limited = ratelimits.is_limited(
            project=project,
            key="rl:DSymFilesEndpoint:download:%s:%s" % (debug_file_id, project.id),
            limit=10,
        )
        if rate_limited:
            logger.info(
                "notification.rate_limited",
                extra={"project_id": project.id, "project_debug_file_id": debug_file_id},
            )
            return HttpResponse({"Too many download requests"}, status=403)

        debug_file = ProjectDebugFile.objects.filter(id=debug_file_id).first()

        if debug_file is None:
            raise Http404

        try:
            fp = debug_file.file.getfile()
            response = StreamingHttpResponse(
                iter(lambda: fp.read(4096), b""), content_type="application/octet-stream"
            )
            response["Content-Length"] = debug_file.file.size
            response["Content-Disposition"] = 'attachment; filename="%s%s"' % (
                posixpath.basename(debug_file.debug_id),
                debug_file.file_extension,
            )
            return response
        except IOError:
            raise Http404

    def get(self, request, project):
        """
        List a Project's Debug Information Files
        ````````````````````````````````````````

        Retrieve a list of debug information files for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          file belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     DIFs of.
        :qparam string query: If set, this parameter is used to locate DIFs with.
        :qparam string id: If set, the specified DIF will be sent in the response.
        :auth: required
        """
        download_requested = request.GET.get("id") is not None
        if download_requested and (request.access.has_scope("project:write")):
            return self.download(request.GET.get("id"), project)

        code_id = request.GET.get("code_id")
        debug_id = request.GET.get("debug_id")
        query = request.GET.get("query")

        # If this query contains a debug identifier, normalize it to allow for
        # more lenient queries (e.g. supporting Breakpad ids). Use the index to
        # speed up such queries.
        if query and len(query) <= 45 and not debug_id:
            try:
                debug_id = normalize_debug_id(query.strip())
            except SymbolicError:
                pass

        if debug_id:
            # If a debug ID is specified, do not consider the stored code
            # identifier and strictly filter by debug identifier. Often there
            # are mismatches in the code identifier in PEs.
            q = Q(debug_id__exact=debug_id)
        elif code_id:
            q = Q(code_id__exact=code_id)
        elif query:
            q = (
                Q(object_name__icontains=query)
                | Q(debug_id__icontains=query)
                | Q(code_id__icontains=query)
                | Q(cpu_name__icontains=query)
                | Q(file__headers__icontains=query)
            )

            KNOWN_DIF_FORMATS_REVERSE = dict((v, k) for (k, v) in six.iteritems(KNOWN_DIF_FORMATS))
            file_format = KNOWN_DIF_FORMATS_REVERSE.get(query)
            if file_format:
                q |= Q(file__headers__icontains=file_format)
        else:
            q = Q()

        queryset = ProjectDebugFile.objects.filter(q, project=project).select_related("file")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-id",
            paginator_cls=OffsetPaginator,
            default_per_page=20,
            on_results=lambda x: serialize(x, request.user),
        )

    def delete(self, request, project):
        """
        Delete a specific Project's Debug Information File
        ```````````````````````````````````````````````````

        Delete a debug information file for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          file belongs to.
        :pparam string project_slug: the slug of the project to delete the
                                     DIF.
        :qparam string id: The id of the DIF to delete.
        :auth: required
        """

        if request.GET.get("id") and (request.access.has_scope("project:write")):
            with transaction.atomic():
                debug_file = (
                    ProjectDebugFile.objects.filter(id=request.GET.get("id"), project=project)
                    .select_related("file")
                    .first()
                )
                if debug_file is not None:
                    debug_file.delete()
                    return Response(status=204)

        return Response(status=404)

    def post(self, request, project):
        """
        Upload a New File
        `````````````````

        Upload a new debug information file for the given release.

        Unlike other API requests, files must be uploaded using the
        traditional multipart/form-data content-type.

        The file uploaded is a zip archive of a Apple .dSYM folder which
        contains the individual debug images.  Uploading through this endpoint
        will create different files for the contained images.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string project_slug: the slug of the project to change the
                                     release of.
        :param file file: the multipart encoded file.
        :auth: required
        """
        return upload_from_request(request, project=project)


class UnknownDebugFilesEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project):
        checksums = request.GET.getlist("checksums")
        missing = ProjectDebugFile.objects.find_missing(checksums, project=project)
        return Response({"missing": missing})


class AssociateDSymFilesEndpoint(ProjectEndpoint):
    doc_section = DocSection.PROJECTS
    permission_classes = (ProjectReleasePermission,)

    # Legacy endpoint, kept for backwards compatibility
    def post(self, request, project):
        return Response({"associatedDsymFiles": []})


def find_missing_chunks(organization, chunks):
    """Returns a list of chunks which are missing for an org."""
    owned = set(
        FileBlobOwner.objects.filter(
            blob__checksum__in=chunks, organization=organization
        ).values_list("blob__checksum", flat=True)
    )
    return list(set(chunks) - owned)


class DifAssembleEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def post(self, request, project):
        """
        Assemble one or multiple chunks (FileBlob) into debug files
        ````````````````````````````````````````````````````````````

        :auth: required
        """
        schema = {
            "type": "object",
            "patternProperties": {
                "^[0-9a-f]{40}$": {
                    "type": "object",
                    "required": ["name", "chunks"],
                    "properties": {
                        "name": {"type": "string"},
                        "debug_id": {"type": "string"},
                        "chunks": {
                            "type": "array",
                            "items": {"type": "string", "pattern": "^[0-9a-f]{40}$"},
                        },
                    },
                    "additionalProperties": True,
                }
            },
            "additionalProperties": False,
        }

        try:
            files = json.loads(request.body)
            jsonschema.validate(files, schema)
        except jsonschema.ValidationError as e:
            return Response({"error": str(e).splitlines()[0]}, status=400)
        except BaseException:
            return Response({"error": "Invalid json body"}, status=400)

        file_response = {}

        for checksum, file_to_assemble in six.iteritems(files):
            name = file_to_assemble.get("name", None)
            debug_id = file_to_assemble.get("debug_id", None)
            chunks = file_to_assemble.get("chunks", [])

            # First, check the cached assemble status. During assembling, a
            # ProjectDebugFile will be created and we need to prevent a race
            # condition.
            state, detail = get_assemble_status(AssembleTask.DIF, project.id, checksum)
            if state == ChunkFileState.OK:
                file_response[checksum] = {
                    "state": state,
                    "detail": None,
                    "missingChunks": [],
                    "dif": detail,
                }
                continue
            elif state is not None:
                file_response[checksum] = {"state": state, "detail": detail, "missingChunks": []}
                continue

            # Next, check if this project already owns the ProjectDebugFile.
            # This can under rare circumstances yield more than one file
            # which is why we use first() here instead of get().
            dif = (
                ProjectDebugFile.objects.filter(project=project, file__checksum=checksum)
                .select_related("file")
                .order_by("-id")
                .first()
            )

            if dif is not None:
                file_response[checksum] = {
                    "state": ChunkFileState.OK,
                    "detail": None,
                    "missingChunks": [],
                    "dif": serialize(dif),
                }
                continue

            # There is neither a known file nor a cached state, so we will
            # have to create a new file.  Assure that there are checksums.
            # If not, we assume this is a poll and report NOT_FOUND
            if not chunks:
                file_response[checksum] = {"state": ChunkFileState.NOT_FOUND, "missingChunks": []}
                continue

            # Check if all requested chunks have been uploaded.
            missing_chunks = find_missing_chunks(project.organization, chunks)
            if missing_chunks:
                file_response[checksum] = {
                    "state": ChunkFileState.NOT_FOUND,
                    "missingChunks": missing_chunks,
                }
                continue

            # We don't have a state yet, this means we can now start
            # an assemble job in the background.
            set_assemble_status(AssembleTask.DIF, project.id, checksum, ChunkFileState.CREATED)

            from sentry.tasks.assemble import assemble_dif

            assemble_dif.apply_async(
                kwargs={
                    "project_id": project.id,
                    "name": name,
                    "debug_id": debug_id,
                    "checksum": checksum,
                    "chunks": chunks,
                }
            )

            file_response[checksum] = {"state": ChunkFileState.CREATED, "missingChunks": []}

        return Response(file_response, status=200)

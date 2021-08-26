import logging
import posixpath
import re

import jsonschema
from django.db import router
from django.db.models import Q
from django.http import Http404, HttpResponse, StreamingHttpResponse
from rest_framework.response import Response
from symbolic import SymbolicError, normalize_debug_id

from sentry import ratelimits, roles
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.constants import DEBUG_FILES_ROLE_DEFAULT, KNOWN_DIF_FORMATS
from sentry.models import (
    File,
    FileBlobOwner,
    OrganizationMember,
    ProjectDebugFile,
    Release,
    ReleaseFile,
    create_files_from_dif_zip,
)
from sentry.models.release import get_artifact_counts
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    get_assemble_status,
    set_assemble_status,
)
from sentry.utils import json
from sentry.utils.db import atomic_transaction

logger = logging.getLogger("sentry.api")
ERR_FILE_EXISTS = "A file matching this debug identifier already exists"
DIF_MIMETYPES = {v: k for k, v in KNOWN_DIF_FORMATS.items()}
_release_suffix = re.compile(r"^(.*)\s+\(([^)]+)\)\s*$")


def upload_from_request(request, project):
    if "file" not in request.data:
        return Response({"detail": "Missing uploaded file"}, status=400)
    fileobj = request.data["file"]
    files = create_files_from_dif_zip(fileobj, project=project)
    return Response(serialize(files, request.user), status=201)


def has_download_permission(request, project):
    if is_system_auth(request.auth) or is_active_superuser(request):
        return True

    if not request.user.is_authenticated:
        return False

    organization = project.organization
    required_role = organization.get_option("sentry:debug_files_role") or DEBUG_FILES_ROLE_DEFAULT

    if request.user.is_sentry_app:
        if roles.get(required_role).priority > roles.get("member").priority:
            return request.access.has_scope("project:write")
        else:
            return request.access.has_scope("project:read")

    try:
        current_role = (
            OrganizationMember.objects.filter(organization=organization, user=request.user)
            .values_list("role", flat=True)
            .get()
        )
    except OrganizationMember.DoesNotExist:
        return False

    return roles.get(current_role).priority >= roles.get(required_role).priority


class DebugFilesEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def download(self, debug_file_id, project):
        rate_limited = ratelimits.is_limited(
            project=project,
            key=f"rl:DSymFilesEndpoint:download:{debug_file_id}:{project.id}",
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
            response["Content-Disposition"] = 'attachment; filename="{}{}"'.format(
                posixpath.basename(debug_file.debug_id),
                debug_file.file_extension,
            )
            return response
        except OSError:
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
        :qparam string file_formats: If set, only DIFs with these formats will be returned.
        :auth: required
        """
        download_requested = request.GET.get("id") is not None
        if download_requested and (has_download_permission(request, project)):
            return self.download(request.GET.get("id"), project)
        elif download_requested:
            return Response(status=403)

        code_id = request.GET.get("code_id")
        debug_id = request.GET.get("debug_id")
        query = request.GET.get("query")
        file_formats = request.GET.getlist("file_formats")

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

            known_file_format = DIF_MIMETYPES.get(query)
            if known_file_format:
                q |= Q(file__headers__icontains=known_file_format)
        else:
            q = Q()

        file_format_q = Q()
        for file_format in file_formats:
            known_file_format = DIF_MIMETYPES.get(file_format)
            if known_file_format:
                file_format_q |= Q(file__headers__icontains=known_file_format)

        q &= file_format_q

        queryset = ProjectDebugFile.objects.filter(q, project_id=project.id).select_related("file")

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
            with atomic_transaction(using=router.db_for_write(File)):
                debug_file = (
                    ProjectDebugFile.objects.filter(id=request.GET.get("id"), project_id=project.id)
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
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project):
        checksums = request.GET.getlist("checksums")
        missing = ProjectDebugFile.objects.find_missing(checksums, project=project)
        return Response({"missing": missing})


class AssociateDSymFilesEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    # Legacy endpoint, kept for backwards compatibility
    def post(self, request, project):
        return Response({"associatedDsymFiles": []})


def find_missing_chunks(organization, chunks):
    """Returns a list of chunks which are missing for an org."""
    owned = set(
        FileBlobOwner.objects.filter(
            blob__checksum__in=chunks, organization_id=organization.id
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
        except Exception:
            return Response({"error": "Invalid json body"}, status=400)

        file_response = {}

        for checksum, file_to_assemble in files.items():
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
                ProjectDebugFile.objects.filter(project_id=project.id, checksum=checksum)
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


class SourceMapsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def get(self, request, project):
        """
        List a Project's Source Map Archives
        ````````````````````````````````````

        Retrieve a list of source map archives (releases, later bundles) for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          source map archive belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     source map archives of.
        :qparam string query: If set, this parameter is used to locate source map archives with.
        :auth: required
        """
        query = request.GET.get("query")

        try:
            queryset = Release.objects.filter(
                projects=project, organization_id=project.organization_id
            ).values("id", "version", "date_added")
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if query:
            query_q = Q(version__icontains=query)

            suffix_match = _release_suffix.match(query)
            if suffix_match is not None:
                query_q |= Q(version__icontains="%s+%s" % suffix_match.groups())

            queryset = queryset.filter(query_q)

        def expose_release(release, count):
            return {
                "type": "release",
                "id": release["id"],
                "name": release["version"],
                "date": release["date_added"],
                "fileCount": count,
            }

        def serialize_results(results):
            file_count_map = get_artifact_counts([r["id"] for r in results])
            return serialize(
                [expose_release(r, file_count_map.get(r["id"], 0)) for r in results], request.user
            )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            default_per_page=10,
            on_results=serialize_results,
        )

    def delete(self, request, project):
        """
        Delete an Archive
        ```````````````````````````````````````````````````

        Delete all artifacts inside given archive.

        :pparam string organization_slug: the slug of the organization the
                                            archive belongs to.
        :pparam string project_slug: the slug of the project to delete the
                                        archive of.
        :qparam string name: The name of the archive to delete.
        :auth: required
        """

        archive_name = request.GET.get("name")

        if archive_name:
            with atomic_transaction(using=router.db_for_write(ReleaseFile)):
                release = Release.objects.get(
                    organization_id=project.organization_id, projects=project, version=archive_name
                )
                if release is not None:
                    release_files = ReleaseFile.objects.filter(release_id=release.id)
                    release_files.delete()
                    return Response(status=204)

        return Response(status=404)

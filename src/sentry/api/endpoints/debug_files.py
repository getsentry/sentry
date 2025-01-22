import logging
import posixpath
import re
import uuid
from collections.abc import Sequence

import jsonschema
import orjson
from django.db import IntegrityError, router
from django.db.models import Q
from django.http import Http404, HttpResponse, StreamingHttpResponse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from symbolic.debuginfo import normalize_debug_id
from symbolic.exceptions import SymbolicError

from sentry import ratelimits
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.auth.access import Access
from sentry.auth.superuser import is_active_superuser
from sentry.auth.system import is_system_auth
from sentry.constants import DEBUG_FILES_ROLE_DEFAULT, KNOWN_DIF_FORMATS
from sentry.debug_files.debug_files import maybe_renew_debug_files
from sentry.debug_files.upload import find_missing_chunks
from sentry.models.debugfile import (
    ProguardArtifactRelease,
    ProjectDebugFile,
    create_files_from_dif_zip,
)
from sentry.models.files.file import File
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.release import Release, get_artifact_counts
from sentry.models.releasefile import ReleaseFile
from sentry.roles import organization_roles
from sentry.tasks.assemble import (
    AssembleTask,
    ChunkFileState,
    get_assemble_status,
    set_assemble_status,
)
from sentry.utils.db import atomic_transaction

logger = logging.getLogger("sentry.api")
ERR_FILE_EXISTS = "A file matching this debug identifier already exists"
DIF_MIMETYPES = {v: k for k, v in KNOWN_DIF_FORMATS.items()}
_release_suffix = re.compile(r"^(.*)\s+\(([^)]+)\)\s*$")


def upload_from_request(request: Request, project: Project):
    if "file" not in request.data:
        return Response({"detail": "Missing uploaded file"}, status=400)
    fileobj = request.data["file"]
    files = create_files_from_dif_zip(fileobj, project=project)
    return Response(serialize(files, request.user), status=201)


def has_download_permission(request: Request, project: Project):
    if is_system_auth(request.auth) or is_active_superuser(request):
        return True

    if not request.user.is_authenticated:
        return False

    organization = project.organization
    required_role = organization.get_option("sentry:debug_files_role") or DEBUG_FILES_ROLE_DEFAULT

    if request.user.is_sentry_app:
        if organization_roles.can_manage("member", required_role):
            return request.access.has_scope("project:write")
        else:
            return request.access.has_scope("project:read")

    try:
        current_role = (
            OrganizationMember.objects.filter(organization=organization, user_id=request.user.id)
            .values_list("role", flat=True)
            .get()
        )
    except OrganizationMember.DoesNotExist:
        return False

    if organization_roles.can_manage(current_role, required_role):
        return True

    # There's an edge case where a team admin is an org member but the required
    # role is org admin. In that case, the team admin should be able to download.
    return required_role == "admin" and request.access.has_project_scope(project, "project:write")


def _has_delete_permission(access: Access, project: Project) -> bool:
    if access.has_scope("project:write"):
        return True
    return access.has_project_scope(project, "project:write")


@region_silo_endpoint
class ProguardArtifactReleasesEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def post(self, request: Request, project: Project) -> Response:
        release_name = request.data.get("release_name")
        proguard_uuid = request.data.get("proguard_uuid")

        missing_fields = []
        if not release_name:
            missing_fields.append("release_name")
        if not proguard_uuid:
            missing_fields.append("proguard_uuid")

        if missing_fields:
            error_message = f"Missing required fields: {', '.join(missing_fields)}"
            return Response(data={"error": error_message}, status=status.HTTP_400_BAD_REQUEST)

        assert release_name is not None and proguard_uuid is not None

        try:
            uuid.UUID(proguard_uuid)
        except ValueError:
            return Response(
                data={"error": "Invalid proguard_uuid"}, status=status.HTTP_400_BAD_REQUEST
            )

        proguard_uuid = str(proguard_uuid)

        difs = ProjectDebugFile.objects.find_by_debug_ids(project, [proguard_uuid])
        if not difs:
            return Response(
                data={"error": "No matching proguard mapping file with this uuid found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            ProguardArtifactRelease.objects.create(
                organization_id=project.organization_id,
                project_id=project.id,
                release_name=release_name,
                project_debug_file=difs[proguard_uuid],
                proguard_uuid=proguard_uuid,
            )
            return Response(status=status.HTTP_201_CREATED)
        except IntegrityError:
            return Response(
                data={
                    "error": "Proguard artifact release with this name in this project already exists."
                },
                status=status.HTTP_409_CONFLICT,
            )

    def get(self, request: Request, project: Project) -> Response:
        """
        List a Project's Proguard Associated Releases
        ````````````````````````````````````````

        Retrieve a list of associated releases for a given Proguard File.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          file belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to list the
                                     DIFs of.
        :qparam string proguard_uuid: the uuid of the Proguard file.
        :auth: required
        """

        proguard_uuid = request.GET.get("proguard_uuid")
        releases = None
        if proguard_uuid:
            releases = ProguardArtifactRelease.objects.filter(
                organization_id=project.organization_id,
                project_id=project.id,
                proguard_uuid=proguard_uuid,
            ).values_list("release_name", flat=True)
        return Response({"releases": releases})


@region_silo_endpoint
class DebugFilesEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def download(self, debug_file_id, project: Project):
        rate_limited = ratelimits.backend.is_limited(
            project=project,
            key=f"rl:DSymFilesEndpoint:download:{debug_file_id}:{project.id}",
            limit=10,
        )
        if rate_limited:
            logger.info(
                "notification.rate_limited",
                extra={"project_id": project.id, "project_debug_file_id": debug_file_id},
            )
            return HttpResponse({"Too many download requests"}, status=429)

        debug_file = ProjectDebugFile.objects.filter(
            id=debug_file_id, project_id=project.id
        ).first()

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

    def get(self, request: Request, project: Project) -> Response:
        """
        List a Project's Debug Information Files
        ````````````````````````````````````````

        Retrieve a list of debug information files for a given project.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          file belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to list the
                                     DIFs of.
        :qparam string query: If set, this parameter is used to locate DIFs with.
        :qparam string id: If set, the specified DIF will be sent in the response.
        :qparam string file_formats: If set, only DIFs with these formats will be returned.
        :auth: required
        """
        download_requested = request.GET.get("id") is not None
        if download_requested and has_download_permission(request, project):
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

        if file_formats:
            file_format_q = Q()
            for file_format in file_formats:
                known_file_format = DIF_MIMETYPES.get(file_format)
                if known_file_format:
                    file_format_q |= Q(file__headers__icontains=known_file_format)
            q &= file_format_q

        q &= Q(project_id=project.id)
        queryset = ProjectDebugFile.objects.filter(q).select_related("file")

        def on_results(difs: Sequence[ProjectDebugFile]):
            # NOTE: we are only refreshing files if there is direct query for specific files
            if debug_id and not query and not file_formats:
                maybe_renew_debug_files(q, difs)

            return serialize(difs, request.user)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-id",
            paginator_cls=OffsetPaginator,
            default_per_page=20,
            on_results=on_results,
        )

    def delete(self, request: Request, project: Project) -> Response:
        """
        Delete a specific Project's Debug Information File
        ```````````````````````````````````````````````````

        Delete a debug information file for a given project.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          file belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to delete the
                                     DIF.
        :qparam string id: The id of the DIF to delete.
        :auth: required
        """
        if request.GET.get("id") and _has_delete_permission(request.access, project):
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

    def post(self, request: Request, project: Project) -> Response:
        """
        Upload a New File
        `````````````````

        Upload a new debug information file for the given release.

        Unlike other API requests, files must be uploaded using the
        traditional multipart/form-data content-type.

        Requests to this endpoint should use the region-specific domain
        eg. `us.sentry.io` or `de.sentry.io`

        The file uploaded is a zip archive of a Apple .dSYM folder which
        contains the individual debug images.  Uploading through this endpoint
        will create different files for the contained images.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          release belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to change the
                                     release of.
        :param file file: the multipart encoded file.
        :auth: required
        """
        return upload_from_request(request, project=project)


@region_silo_endpoint
class UnknownDebugFilesEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project: Project) -> Response:
        checksums = request.GET.getlist("checksums")
        missing = ProjectDebugFile.objects.find_missing(checksums, project=project)
        return Response({"missing": missing})


@region_silo_endpoint
class AssociateDSymFilesEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    # Legacy endpoint, kept for backwards compatibility
    def post(self, request: Request, project: Project) -> Response:
        return Response({"associatedDsymFiles": []})


def get_file_info(files, checksum):
    """
    Extracts file information from files given a checksum.
    """
    file = files.get(checksum)
    if file is None:
        return None

    name = file.get("name")
    debug_id = file.get("debug_id")
    chunks = file.get("chunks", [])

    return name, debug_id, chunks


def batch_assemble(project, files):
    """
    Performs assembling in a batch fashion, issuing queries that span multiple files.
    """
    # We build a set of all the checksums that still need checks.
    checksums_to_check = {checksum for checksum in files.keys()}
    file_response = {}

    # 1. Exclude all files that have already an assemble status.
    for checksum in checksums_to_check:
        # First, check the cached assemble status. During assembling, a
        # `ProjectDebugFile` will be created, and we need to prevent a race
        # condition.
        state, detail = get_assemble_status(AssembleTask.DIF, project.id, checksum)
        if state == ChunkFileState.OK:
            file_response[checksum] = {
                "state": state,
                "detail": None,
                "missingChunks": [],
                "dif": detail,
            }
            checksums_to_check.remove(checksum)
        elif state is not None:
            file_response[checksum] = {"state": state, "detail": detail, "missingChunks": []}
            checksums_to_check.remove(checksum)

    # 2. Check if this project already owns the `ProjectDebugFile` for each file.
    debug_files = ProjectDebugFile.objects.filter(
        project_id=project.id,
        checksum__in=checksums_to_check,
    ).select_related("file")
    for debug_file in debug_files:
        file_response[debug_file.checksum] = {
            "state": ChunkFileState.OK,
            "detail": None,
            "missingChunks": [],
            "dif": serialize(debug_file),
        }
        checksums_to_check.remove(debug_file.checksum)

    # 3. Compute all the chunks that have to be checked for existence.
    chunks_to_check = {}
    for checksum in checksums_to_check:
        file_info = get_file_info(files, checksum)

        # There is neither a known file nor a cached state, so we will
        # have to create a new file. Assure that there are checksums.
        # If not, we assume this is a poll and report `NOT_FOUND`.
        if file_info is None or not file_info[2]:
            file_response[checksum] = {"state": ChunkFileState.NOT_FOUND, "missingChunks": []}
            checksums_to_check.remove(checksum)

        # We make an inverted index from chunk to check to its checksum.
        chunks_to_check[file_info[2]] = checksum

    # 4. Find missing chunks and group them per checksum.
    all_missing_chunks = find_missing_chunks(project.organization.id, chunks_to_check)
    missing_chunks_per_checksum = {}
    for chunk in all_missing_chunks:
        # We access the chunk via `[]` since the chunk must be there since `all_missing_chunks` must be a subset of
        # `chunks_to_check.keys()`.
        missing_chunks_per_checksum.setdefault(chunks_to_check[chunk], set()).add(chunk)

    # 5. Report missing chunks per checksum.
    for checksum, missing_chunks in missing_chunks_per_checksum.items():
        file_response[checksum] = {
            "state": ChunkFileState.NOT_FOUND,
            "missingChunks": missing_chunks,
        }
        checksums_to_check.remove(checksum)

    from sentry.tasks.assemble import assemble_dif

    # 6. Kickstart async assembling for all remaining chunks that have passed all checks.
    for checksum in checksums_to_check:
        file_info = get_file_info(files, checksum)
        if file_info is None:
            continue

        name, debug_id, chunks = file_info
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

    return file_response


def sequential_assemble(project, files):
    """
    Performs assembling in a sequential fashion, issuing queries for each file, identified by its `checksum`.
    """
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
        missing_chunks = find_missing_chunks(project.organization.id, chunks)
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

    return file_response


@region_silo_endpoint
class DifAssembleEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def post(self, request: Request, project: Project) -> Response:
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
            files = orjson.loads(request.body)
            jsonschema.validate(files, schema)
        except jsonschema.ValidationError as e:
            return Response({"error": str(e).splitlines()[0]}, status=400)
        except Exception:
            return Response({"error": "Invalid json body"}, status=400)

        # TODO: implement feature flag check.
        use_batch_assemble = True
        if use_batch_assemble:
            file_response = batch_assemble(project=project, files=files)
        else:
            file_response = sequential_assemble(project=project, files=files)

        return Response(file_response, status=200)


@region_silo_endpoint
class SourceMapsEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project: Project) -> Response:
        """
        List a Project's Source Map Archives
        ````````````````````````````````````

        Retrieve a list of source map archives (releases, later bundles) for a given project.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          source map archive belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to list the
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

        def expose_release(release, count: int):
            return {
                "type": "release",
                "id": release["id"],
                "name": release["version"],
                "date": release["date_added"],
                "fileCount": count,
            }

        def serialize_results(results):
            file_count_map = get_artifact_counts([r["id"] for r in results])
            # In case we didn't find a file count for a specific release, we will return -1, signaling to the
            # frontend that this release doesn't have one or more ReleaseFile.
            return serialize(
                [expose_release(r, file_count_map.get(r["id"], -1)) for r in results], request.user
            )

        sort_by = request.GET.get("sortBy", "-date_added")
        if sort_by not in {"-date_added", "date_added"}:
            return Response(
                {"error": "You can either sort via 'date_added' or '-date_added'"}, status=400
            )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=sort_by,
            paginator_cls=OffsetPaginator,
            default_per_page=10,
            on_results=serialize_results,
        )

    def delete(self, request: Request, project: Project) -> Response:
        """
        Delete an Archive
        ```````````````````````````````````````````````````

        Delete all artifacts inside given archive.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                            archive belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to delete the
                                        archive of.
        :qparam string name: The name of the archive to delete.
        :auth: required
        """

        archive_name = request.GET.get("name")

        if archive_name:
            with atomic_transaction(using=router.db_for_write(ReleaseFile)):
                try:
                    release = Release.objects.get(
                        organization_id=project.organization_id,
                        projects=project,
                        version=archive_name,
                    )
                except Release.DoesNotExist:
                    raise ResourceDoesNotExist(detail="The provided release does not exist")
                if release is not None:
                    release_files = ReleaseFile.objects.filter(release_id=release.id)
                    release_files.delete()
                    return Response(status=204)

        return Response(status=404)

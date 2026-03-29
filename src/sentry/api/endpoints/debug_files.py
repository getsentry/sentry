import logging
import posixpath
import re
import uuid
from collections.abc import Iterable, Mapping, Sequence, Set
from typing import TYPE_CHECKING, NotRequired, TypedDict, TypeGuard, cast

import jsonschema
import orjson
from django.db import IntegrityError, router
from django.db.models import Case, Exists, F, IntegerField, Q, QuerySet, Value, When
from django.http import Http404, HttpResponse, StreamingHttpResponse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from symbolic.debuginfo import normalize_debug_id
from symbolic.exceptions import SymbolicError

if TYPE_CHECKING:
    from django_stubs_ext import WithAnnotations

from sentry import ratelimits
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
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
from sentry.lang.native.sources import record_last_upload
from sentry.models.debugfile import (
    ProguardArtifactRelease,
    ProjectDebugFile,
    build_proguard_reupload_dif_meta,
    create_dif_from_id,
    create_files_from_dif_zip,
    get_debug_id_from_dif_request,
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
    required_role = (
        project.get_option("sentry:debug_files_role")
        or organization.get_option("sentry:debug_files_role")
        or DEBUG_FILES_ROLE_DEFAULT
    )

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


@cell_silo_endpoint
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


@cell_silo_endpoint
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
            response["Content-Disposition"] = (
                f'attachment; filename="{posixpath.basename(debug_file.debug_id)}{debug_file.file_extension}"'
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

        q = Q(project_id=project.id)
        if file_formats:
            file_format_q = Q()
            for file_format in file_formats:
                known_file_format = DIF_MIMETYPES.get(file_format)
                if known_file_format:
                    file_format_q |= Q(file__headers__icontains=known_file_format)
            q &= file_format_q

        queryset = None
        if debug_id and code_id:
            # Be lenient when searching for debug files, check either for a matching debug id
            # or a matching code id. We only fallback to code id if there is no debug id match.
            # While both identifiers should be unique, in practice they are not and the debug id
            # yields better results.
            #
            # Ideally debug- and code-id yield the same files, but especially on Windows it is possible
            # that the debug id does not perfectly match due to 'age' differences, but the code-id
            # will match.
            debug_id_qs = ProjectDebugFile.objects.filter(Q(debug_id__exact=debug_id) & q)
            queryset = debug_id_qs.select_related("file").union(
                ProjectDebugFile.objects.filter(Q(code_id__exact=code_id) & q)
                # Only return any code id matches if there are *no* debug id matches.
                .filter(~Exists(debug_id_qs))
                .select_related("file")
            )
        elif debug_id:
            q &= Q(debug_id__exact=debug_id)
        elif code_id:
            q &= Q(code_id__exact=code_id)
        elif query:
            query_q = (
                Q(object_name__icontains=query)
                | Q(debug_id__icontains=query)
                | Q(code_id__icontains=query)
                | Q(cpu_name__icontains=query)
                | Q(file__headers__icontains=query)
            )

            known_file_format = DIF_MIMETYPES.get(query)
            if known_file_format:
                query_q |= Q(file__headers__icontains=known_file_format)

            q &= query_q

        if queryset is None:
            queryset = ProjectDebugFile.objects.filter(q).select_related("file")

        def on_results(difs: Sequence[ProjectDebugFile]):
            # NOTE: we are only refreshing files if there is direct query for specific files
            if debug_id and not query and not file_formats:
                maybe_renew_debug_files(difs)

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
        debug_file_id = request.GET.get("id")
        if debug_file_id and _has_delete_permission(request.access, project):
            with atomic_transaction(using=router.db_for_write(File)):
                debug_file = (
                    ProjectDebugFile.objects.filter(id=debug_file_id, project_id=project.id)
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


@cell_silo_endpoint
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


@cell_silo_endpoint
class AssociateDSymFilesEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    # Legacy endpoint, kept for backwards compatibility
    def post(self, request: Request, project: Project) -> Response:
        return Response({"associatedDsymFiles": []})


class AssembleRequestFile(TypedDict):
    """One file entry from the DIF assemble request body."""

    name: str
    chunks: list[str]
    debug_id: NotRequired[str]


AssembleRequestPayload = dict[str, AssembleRequestFile]
"""Mapping from file checksums to the corresponding assemble request payload."""


def parse_assemble_request_payload(body: bytes) -> AssembleRequestPayload:
    """Parse and validate the DIF assemble request body."""
    schema: dict[str, object] = {
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
    payload_obj: object = orjson.loads(body)
    jsonschema.validate(payload_obj, schema)
    return cast(AssembleRequestPayload, payload_obj)


def get_file_info(file: AssembleRequestFile) -> tuple[str, str | None, list[str]]:
    """
    Extracts file information from one assemble payload.
    """
    name = file["name"]
    debug_id = file.get("debug_id")
    chunks = file["chunks"]

    return name, debug_id, chunks


def batch_assemble(project: Project, files: AssembleRequestPayload):
    """
    Performs assembling in a batch fashion, issuing queries that span multiple files.
    """
    files_to_check = files.copy()
    file_response = {}

    # 1. Exclude all files that already have an assemble status.
    for checksum, file in list(files_to_check.items()):
        # First, check the cached assemble status. During assembling, a
        # `ProjectDebugFile` will be created, and we need to prevent a race
        # condition.
        state, detail = get_assemble_status(AssembleTask.DIF, project.id, checksum)
        requested_debug_id = _get_requested_debug_id(file)
        cached_debug_id = detail.get("uuid") if isinstance(detail, Mapping) else None

        if state == ChunkFileState.OK and not _is_proguard_reupload_clone_request(
            file=file,
            requested_debug_id=requested_debug_id,
            selected_debug_id=cached_debug_id,
        ):
            file_response[checksum] = {
                "state": state,
                "detail": None,
                "missingChunks": [],
                "dif": detail,
            }
            files_to_check.pop(checksum)
        elif state is not None and state != ChunkFileState.OK:
            file_response[checksum] = {"state": state, "detail": detail, "missingChunks": []}
            files_to_check.pop(checksum)

    # 2. Check if this project already owns the `ProjectDebugFile` for each file,
    # also create ProGuard reupload clones if applicable.
    requested_debug_ids_by_checksum = {
        checksum: _get_requested_debug_id(file) for checksum, file in files_to_check.items()
    }
    existing_debug_files = _find_existing_debug_files(
        project=project,
        checksums=files_to_check.keys(),
        requested_debug_ids_by_checksum=requested_debug_ids_by_checksum,
    )

    for debug_file in existing_debug_files:
        checksum = debug_file.nonnull_checksum
        file = files_to_check.pop(checksum)
        requested_debug_id = requested_debug_ids_by_checksum[checksum]

        if _is_proguard_reupload_clone_request(
            requested_debug_id=requested_debug_id,
            file=file,
            selected_debug_id=debug_file.debug_id,
        ):
            file_response[checksum] = _clone_proguard_debug_file_for_reupload(
                project=project,
                debug_file=debug_file,
                requested_debug_id=requested_debug_id,
                is_proguard_clone_source=bool(debug_file.proguard_clone_source_match),
            )
            continue

        file_response[checksum] = {
            "state": ChunkFileState.OK,
            "detail": None,
            "missingChunks": [],
            "dif": serialize(debug_file),
        }

    # 3. Compute all the chunks that have to be checked for existence.
    chunks_to_check = {}
    for checksum, file in list(files_to_check.items()):
        name, debug_id, chunks = get_file_info(file)

        # If we don't have any chunks, this is likely a poll request
        # checking for file status, so return NOT_FOUND.
        if not chunks:
            file_response[checksum] = {"state": ChunkFileState.NOT_FOUND, "missingChunks": []}
            files_to_check.pop(checksum)
            continue

        # Map each chunk back to its source file checksum.
        for chunk in chunks:
            chunks_to_check[chunk] = checksum

    # 4. Find missing chunks and group them per checksum.
    all_missing_chunks = find_missing_chunks(project.organization.id, chunks_to_check.keys())

    missing_chunks_per_checksum: dict[str, set[str]] = {}
    for chunk in all_missing_chunks:
        # We access the chunk via `[]` since the chunk must be there since `all_missing_chunks` must be a subset of
        # `chunks_to_check.keys()`.
        missing_chunks_per_checksum.setdefault(chunks_to_check[chunk], set()).add(chunk)

    # 5. Report missing chunks per checksum.
    for checksum, missing_chunks in missing_chunks_per_checksum.items():
        file_response[checksum] = {
            "state": ChunkFileState.NOT_FOUND,
            "missingChunks": list(missing_chunks),
        }
        files_to_check.pop(checksum, None)

    from sentry.tasks.assemble import assemble_dif

    # 6. Kickstart async assembling for all remaining chunks that have passed all checks.
    for checksum, file in files_to_check.items():
        # We don't have a state yet, this means we can now start an assemble job in the background and mark
        # this in the state.
        set_assemble_status(AssembleTask.DIF, project.id, checksum, ChunkFileState.CREATED)

        name, debug_id, chunks = get_file_info(file)
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


def _get_requested_debug_id(file: AssembleRequestFile) -> str | None:
    """Returns the effective requested debug ID for one assemble payload.

    This normalizes an explicit ``debug_id`` when present, or derives one from a
    ProGuard-style request name such as ``/proguard/mapping-<uuid>.txt``.
    """
    return get_debug_id_from_dif_request(name=file["name"], debug_id=file.get("debug_id"))


def _is_requested_proguard(file: AssembleRequestFile) -> bool:
    """Returns whether one assemble payload should be treated as a ProGuard request.

    This is true only when the request's effective debug ID comes from a
    ProGuard-style filename, rather than merely from an explicit ``debug_id``.
    """
    name = file["name"]
    requested_debug_id = _get_requested_debug_id(file)
    return (
        requested_debug_id is not None
        and get_debug_id_from_dif_request(name=name, debug_id=None) == requested_debug_id
    )


def _is_proguard_reupload_clone_request(
    requested_debug_id: str | None,
    file: AssembleRequestFile,
    selected_debug_id: str | None,
) -> TypeGuard[str]:
    """Return whether the assemble request should clone a ProGuard debug file."""
    return (
        requested_debug_id is not None
        and requested_debug_id != selected_debug_id
        and _is_requested_proguard(file)
    )


class _DebugFileAnnotations(TypedDict):
    nonnull_checksum: str
    requested_debug_id_match: int
    proguard_clone_source_match: int


def _find_existing_debug_files(
    project: Project,
    checksums: Set[str],
    requested_debug_ids_by_checksum: dict[str, str | None],
) -> "QuerySet[WithAnnotations[ProjectDebugFile, _DebugFileAnnotations]]":
    """Find up to one existing `ProjectDebugFile` row per requested checksum.

    This query is used to determine whether assemble can be satisfied from rows
    that already exist for the project, or whether the request must continue to
    chunk lookup and async assembly.

    It only considers `ProjectDebugFile` rows in the same project and for the
    requested checksums. The result contains at most one row per checksum,
    chosen by SQL ordering plus `distinct("checksum")`.

    Two annotations are added and preserved on the returned rows:

    - `requested_debug_id_match`: `1` when the row exactly matches the
      effective requested debug ID for that checksum, else `0`.
    - `proguard_clone_source_match`: `1` when the row points at a stored
      ProGuard `project.dif` file that is safe to reuse as the source for a
      ProGuard reupload clone, else `0`.

    Rows are ordered so each checksum prefers:

    1. an exact requested debug ID match,
    2. otherwise a valid ProGuard clone source,
    3. otherwise the newest remaining row.

    If no result is returned for a given checksum, no `ProjectDebugFile` rows
    with that checksum exist in the given project.

    Downstream, `batch_assemble` uses that selected row to decide whether the
    checksum is already satisfied, whether a ProGuard alias row should be
    created, or whether the request still needs upload work.
    """
    return (
        ProjectDebugFile.objects.filter(
            project_id=project.id,
            checksum__in=checksums,
            checksum__isnull=False,
        )
        .annotate(
            # Mirror the filtered checksum into an annotated non-null field for type safety.
            nonnull_checksum=F("checksum"),
            requested_debug_id_match=_build_requested_debug_id_match_annotation(
                requested_debug_ids_by_checksum.items()
            ),
            proguard_clone_source_match=_build_proguard_clone_source_annotation(checksums),
        )
        .select_related("file")
        .order_by("checksum", "-requested_debug_id_match", "-proguard_clone_source_match", "-id")
        .distinct("checksum")
    )


def _build_requested_debug_id_match_annotation(
    requested_debug_ids: Iterable[tuple[str, str | None]],
) -> Case:
    """Builds a per-row match score for exact requested debug ID matches.

    The annotation returns ``1`` when a row's ``checksum`` and ``debug_id`` match
    the effective requested debug ID for that checksum, and ``0`` otherwise.
    """
    return Case(
        *[
            When(checksum=checksum, debug_id=debug_id, then=Value(1))
            for checksum, debug_id in requested_debug_ids
            if debug_id is not None
        ],
        default=Value(0),
        output_field=IntegerField(),
    )


def _build_proguard_clone_source_annotation(checksums: Iterable[str]) -> Case:
    """Builds a per-row match score for ProGuard clone-source selection.

    The annotation returns ``1`` when a row belongs to one of the requested
    checksums, points at a ``project.dif`` file, and its linked ``File`` has
    headers exactly matching the stored ProGuard content type. It returns ``0``
    for all other rows.
    """
    return Case(
        When(
            checksum__in=checksums,
            file__type="project.dif",
            file__headers={"Content-Type": DIF_MIMETYPES["proguard"]},
            then=Value(1),
        ),
        default=Value(0),
        output_field=IntegerField(),
    )


def _clone_proguard_debug_file_for_reupload(
    project: Project,
    debug_file: ProjectDebugFile,
    requested_debug_id: str,
    is_proguard_clone_source: bool,
) -> dict[str, object]:
    """Clone a ProGuard debug file row for a reupload and return a batch response.

    ``is_proguard_clone_source`` must reflect the caller's annotation-based
    selection result for whether ``debug_file`` is a valid ProGuard clone source.
    If it is false, this returns an error response payload. Otherwise it creates
    or reuses the ``ProjectDebugFile`` row for ``requested_debug_id`` and
    returns an OK response payload.
    """
    if not is_proguard_clone_source:
        return {
            "state": ChunkFileState.ERROR,
            "detail": "This file is not a ProGuard mapping.",
            "missingChunks": [],
        }

    meta = build_proguard_reupload_dif_meta(debug_file, requested_debug_id)
    dif, created = create_dif_from_id(project, meta, file=debug_file.file)
    if created:
        record_last_upload(project)

    return {
        "state": ChunkFileState.OK,
        "detail": None,
        "missingChunks": [],
        "dif": serialize(dif),
    }


@cell_silo_endpoint
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
        try:
            files = parse_assemble_request_payload(request.body)
        except jsonschema.ValidationError as e:
            return Response({"error": str(e).splitlines()[0]}, status=400)
        except Exception:
            return Response({"error": "Invalid json body"}, status=400)

        file_response = batch_assemble(project=project, files=files)

        return Response(file_response, status=200)


@cell_silo_endpoint
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

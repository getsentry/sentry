import hashlib
import logging
from os import path
from typing import List, Optional, Set, Tuple

from django.db import IntegrityError, router, transaction
from django.db.models import Q
from django.utils import timezone
from symbolic import SymbolicError, normalize_debug_id

from sentry import options
from sentry.api.serializers import serialize
from sentry.cache import default_cache
from sentry.db.models.fields import uuid
from sentry.models import File, Organization, Release, ReleaseFile
from sentry.models.artifactbundle import (
    ArtifactBundle,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
    SourceFileType,
)
from sentry.models.releasefile import ReleaseArchive, update_artifact_index
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.files import get_max_file_size
from sentry.utils.sdk import bind_organization_context, configure_scope

logger = logging.getLogger(__name__)


class ChunkFileState:
    OK = "ok"  # File in database
    NOT_FOUND = "not_found"  # File not found in database
    CREATED = "created"  # File was created in the request and send to the worker for assembling
    ASSEMBLING = "assembling"  # File still being processed by worker
    ERROR = "error"  # Error happened during assembling


class AssembleTask:
    DIF = "project.dsym"  # Debug file upload
    ARTIFACTS = "organization.artifacts"  # Release file upload


def _get_cache_key(task, scope, checksum):
    """Computes the cache key for assemble status.

    ``task`` must be one of the ``AssembleTask`` values. The scope can be the
    identifier of any model, such as the organization or project that this task
    is performed under.

    ``checksum`` should be the SHA1 hash of the main file that is being
    assembled.
    """
    return (
        "assemble-status:%s"
        % hashlib.sha1(
            b"%s|%s|%s"
            % (
                str(scope).encode("ascii"),
                checksum.encode("ascii"),
                str(task).encode("utf-8"),
            )
        ).hexdigest()
    )


def get_assemble_status(task, scope, checksum):
    """
    Checks the current status of an assembling task.

    Returns a tuple in the form ``(status, details)``, where ``status`` is the
    ChunkFileState, and ``details`` is either None or a string containing a
    notice or error message.
    """
    cache_key = _get_cache_key(task, scope, checksum)
    rv = default_cache.get(cache_key)
    if rv is None:
        return None, None
    return tuple(rv)


def set_assemble_status(task, scope, checksum, state, detail=None):
    """
    Updates the status of an assembling task. It is cached for 10 minutes.
    """
    cache_key = _get_cache_key(task, scope, checksum)
    default_cache.set(cache_key, (state, detail), 600)


@instrumented_task(name="sentry.tasks.assemble.assemble_dif", queue="assemble")
def assemble_dif(project_id, name, checksum, chunks, debug_id=None, **kwargs):
    """
    Assembles uploaded chunks into a ``ProjectDebugFile``.
    """
    from sentry.models import BadDif, Project, debugfile
    from sentry.reprocessing import bump_reprocessing_revision

    with configure_scope() as scope:
        scope.set_tag("project", project_id)

    delete_file = False

    try:
        project = Project.objects.filter(id=project_id).get()
        set_assemble_status(AssembleTask.DIF, project_id, checksum, ChunkFileState.ASSEMBLING)

        # Assemble the chunks into a temporary file
        rv = assemble_file(
            AssembleTask.DIF, project, name, checksum, chunks, file_type="project.dif"
        )

        # If not file has been created this means that the file failed to
        # assemble because of bad input data. In this case, assemble_file
        # has set the assemble status already.
        if rv is None:
            return

        file, temp_file = rv
        delete_file = True

        with temp_file:
            # We only permit split difs to hit this endpoint.  The
            # client is required to split them up first or we error.
            try:
                result = debugfile.detect_dif_from_path(
                    temp_file.name, name=name, debug_id=debug_id
                )
            except BadDif as e:
                set_assemble_status(
                    AssembleTask.DIF, project_id, checksum, ChunkFileState.ERROR, detail=e.args[0]
                )
                return

            if len(result) != 1:
                detail = "Object contains %s architectures (1 expected)" % len(result)
                set_assemble_status(
                    AssembleTask.DIF, project_id, checksum, ChunkFileState.ERROR, detail=detail
                )
                return

            dif, created = debugfile.create_dif_from_id(project, result[0], file=file)
            delete_file = False

            if created:
                # Bump the reprocessing revision since the symbol has changed
                # and might resolve processing issues. If the file was not
                # created, someone else has created it and will bump the
                # revision instead.
                bump_reprocessing_revision(project, use_buffer=True)
    except Exception:
        set_assemble_status(
            AssembleTask.DIF,
            project_id,
            checksum,
            ChunkFileState.ERROR,
            detail="internal server error",
        )
        logger.error("failed to assemble dif", exc_info=True)
    else:
        set_assemble_status(
            AssembleTask.DIF, project_id, checksum, ChunkFileState.OK, detail=serialize(dif)
        )
    finally:
        if delete_file:
            file.delete()  # type:ignore


class AssembleArtifactsError(Exception):
    pass


def _simple_update(
    release_file: ReleaseFile, new_file: File, new_archive: ReleaseArchive, additional_fields: dict
) -> bool:
    """Update function used in _upsert_release_file"""
    old_file = release_file.file
    release_file.update(file=new_file, **additional_fields)
    old_file.delete()

    return True


def _upsert_release_file(
    file: File, archive: ReleaseArchive, update_fn, key_fields, additional_fields
) -> bool:
    success = False
    release_file = None

    # Release files must have unique names within their release
    # and dist. If a matching file already exists, replace its
    # file with the new one; otherwise create it.
    try:
        release_file = ReleaseFile.objects.get(**key_fields)
    except ReleaseFile.DoesNotExist:
        try:
            with atomic_transaction(using=router.db_for_write(ReleaseFile)):
                release_file = ReleaseFile.objects.create(
                    file=file, **dict(key_fields, **additional_fields)
                )
        except IntegrityError:
            # NB: This indicates a race, where another assemble task or
            # file upload job has just created a conflicting file. Since
            # we're upserting here anyway, yield to the faster actor and
            # do not try again.
            file.delete()
        else:
            success = True
    else:
        success = update_fn(release_file, file, archive, additional_fields)

    return success


def get_artifact_basename(url):
    return url.rsplit("/", 1)[-1]


def _store_single_files(archive: ReleaseArchive, meta: dict, count_as_artifacts: bool):
    try:
        temp_dir = archive.extract()
    except Exception:
        raise AssembleArtifactsError("failed to extract bundle")

    with temp_dir:
        artifacts = archive.manifest.get("files", {})
        for rel_path, artifact in artifacts.items():
            artifact_url = artifact.get("url", rel_path)
            artifact_basename = get_artifact_basename(artifact_url)

            file = File.objects.create(
                name=artifact_basename, type="release.file", headers=artifact.get("headers", {})
            )

            full_path = path.join(temp_dir.name, rel_path)
            with open(full_path, "rb") as fp:
                file.putfile(fp, logger=logger)

            kwargs = dict(meta, name=artifact_url)
            extra_fields = {"artifact_count": 1 if count_as_artifacts else 0}
            _upsert_release_file(file, None, _simple_update, kwargs, extra_fields)


def _normalize_headers(headers: dict) -> dict:
    return {k.lower(): v for k, v in headers.items()}


def _normalize_debug_id(debug_id: Optional[str]) -> Optional[str]:
    try:
        return normalize_debug_id(debug_id)
    except SymbolicError:
        return None


def _extract_debug_ids_from_manifest(
    manifest: dict,
) -> Tuple[Optional[str], Set[Tuple[SourceFileType, str]]]:
    # We use a set, since we might have the same debug_id and file_type.
    debug_ids_with_types = set()

    # We also want to extract the bundle_id which is also known as the bundle debug_id. This id is used to uniquely
    # identify a specific ArtifactBundle in case for example of future deletion.
    #
    # If no id is found, it means that we must have an associated release to this ArtifactBundle, through the
    # ReleaseArtifactBundle table.
    bundle_id = manifest.get("debug_id")
    if bundle_id is not None:
        bundle_id = _normalize_debug_id(bundle_id)

    files = manifest.get("files", {})
    for file_path, info in files.items():
        headers = _normalize_headers(info.get("headers", {}))
        if (debug_id := headers.get("debug-id")) is not None:
            debug_id = _normalize_debug_id(debug_id)
            file_type = info.get("type")
            if (
                debug_id is not None
                and file_type is not None
                and (source_file_type := SourceFileType.from_lowercase_key(file_type)) is not None
            ):
                debug_ids_with_types.add((source_file_type, debug_id))

    return bundle_id, debug_ids_with_types


def _remove_duplicate_artifact_bundles(bundle: ArtifactBundle, bundle_id: str):
    with transaction.atomic():
        # Even though we delete via a QuerySet the associated file is also deleted, because django will still
        # fire the on_delete signal.
        ArtifactBundle.objects.filter(
            ~Q(id=bundle.id), bundle_id=bundle_id, organization_id=bundle.organization_id
        ).delete()


def _create_artifact_bundle(
    version: Optional[str],
    dist: Optional[str],
    org_id: int,
    project_ids: Optional[List[int]],
    archive_file: File,
    artifact_count: int,
):
    with ReleaseArchive(archive_file.getfile()) as archive:
        bundle_id, debug_ids_with_types = _extract_debug_ids_from_manifest(archive.manifest)

        # We want to save an artifact bundle only if we have found debug ids in the manifest or if the user specified
        # a release for the upload.
        if len(debug_ids_with_types) > 0 or version:
            now = timezone.now()

            artifact_bundle = ArtifactBundle.objects.create(
                organization_id=org_id,
                # In case we didn't find the bundle_id in the manifest, we will just generate our own.
                bundle_id=bundle_id or uuid.uuid4().hex,
                file=archive_file,
                artifact_count=artifact_count,
                # For now these two fields will have the same value but in separate tasks we will update "date_added"
                # in order to perform partitions rebalancing in the database.
                date_added=now,
                date_uploaded=now,
            )

            # If a release version is passed, we want to create the weak association between a bundle and a release.
            if version:
                ReleaseArtifactBundle.objects.create(
                    organization_id=org_id,
                    release_name=version,
                    # In case no dist is provided, we will fall back to "" which is the NULL equivalent for our tables.
                    dist_name=dist or "",
                    artifact_bundle=artifact_bundle,
                    date_added=now,
                )

            for project_id in project_ids or ():
                ProjectArtifactBundle.objects.create(
                    organization_id=org_id,
                    project_id=project_id,
                    artifact_bundle=artifact_bundle,
                    date_added=now,
                )

            for source_file_type, debug_id in debug_ids_with_types:
                DebugIdArtifactBundle.objects.create(
                    organization_id=org_id,
                    debug_id=debug_id,
                    artifact_bundle=artifact_bundle,
                    source_file_type=source_file_type.value,
                    date_added=now,
                )

            _remove_duplicate_artifact_bundles(artifact_bundle, bundle_id)
        else:
            raise AssembleArtifactsError(
                "uploading a bundle without debug ids or release is prohibited"
            )


def handle_assemble_for_release_file(bundle, archive, organization, version):
    manifest = archive.manifest

    if manifest.get("org") != organization.slug:
        raise AssembleArtifactsError("organization does not match uploaded bundle")

    if manifest.get("release") != version:
        raise AssembleArtifactsError("release does not match uploaded bundle")

    try:
        release = Release.objects.get(organization_id=organization.id, version=version)
    except Release.DoesNotExist:
        raise AssembleArtifactsError("release does not exist")

    dist_name = manifest.get("dist")
    dist = release.add_dist(dist_name) if dist_name else None

    min_artifact_count = options.get("processing.release-archive-min-files")
    saved_as_archive = False

    if archive.artifact_count >= min_artifact_count:
        try:
            update_artifact_index(release, dist, bundle)
            saved_as_archive = True
        except Exception as exc:
            logger.error("Unable to update artifact index", exc_info=exc)

    if not saved_as_archive:
        meta = {
            "organization_id": organization.id,
            "release_id": release.id,
            "dist_id": dist.id if dist else dist,
        }
        _store_single_files(archive, meta, True)


def handle_assemble_for_artifact_bundle(bundle, archive, organization, version, dist, project_ids):
    # We want to give precedence to the request fields and only if they are unset fallback to the manifest's
    # contents.
    version = version or archive.manifest.get("release")
    dist = dist or archive.manifest.get("dist")
    _create_artifact_bundle(
        version, dist, organization.id, project_ids, bundle, archive.artifact_count
    )


@instrumented_task(name="sentry.tasks.assemble.assemble_artifacts", queue="assemble")
def assemble_artifacts(
    org_id,
    version,
    checksum,
    chunks,
    # These params have been added for supporting artifact bundles assembling.
    project_ids=None,
    dist=None,
    upload_as_artifact_bundle=False,
    **kwargs,
):
    """
    Creates a release file or artifact bundle from an uploaded bundle given the checksums of its chunks.
    """
    if project_ids is None:
        project_ids = []

    try:
        organization = Organization.objects.get_from_cache(pk=org_id)
        bind_organization_context(organization)

        set_assemble_status(AssembleTask.ARTIFACTS, org_id, checksum, ChunkFileState.ASSEMBLING)

        archive_name = "bundle-artifacts" if upload_as_artifact_bundle else "release-artifacts"
        archive_filename = f"{archive_name}-{uuid.uuid4().hex}.zip"
        file_type = "artifact.bundle" if upload_as_artifact_bundle else "release.bundle"

        # Assemble the chunks into a temporary file
        rv = assemble_file(
            AssembleTask.ARTIFACTS,
            organization,
            archive_filename,
            checksum,
            chunks,
            file_type,
        )

        # If not file has been created this means that the file failed to
        # assemble because of bad input data. In this case, assemble_file
        # has set the assemble status already.
        if rv is None:
            return

        bundle, temp_file = rv

        try:
            # TODO(iambriccardo): Once the new lookup PR is merged it would be better if we generalize the archive
            #  handling class.
            archive = ReleaseArchive(temp_file)
        except Exception:
            raise AssembleArtifactsError("failed to open release manifest")

        with archive:
            if upload_as_artifact_bundle:
                handle_assemble_for_artifact_bundle(
                    bundle, archive, organization, version, dist, project_ids
                )
            else:
                handle_assemble_for_release_file(bundle, archive, organization, version)

            # Count files extracted, to compare them to release files endpoint
            metrics.incr("tasks.assemble.extracted_files", amount=archive.artifact_count)
    except AssembleArtifactsError as e:
        set_assemble_status(
            AssembleTask.ARTIFACTS, org_id, checksum, ChunkFileState.ERROR, detail=str(e)
        )
    except Exception:
        logger.error("failed to assemble release bundle", exc_info=True)
        set_assemble_status(
            AssembleTask.ARTIFACTS,
            org_id,
            checksum,
            ChunkFileState.ERROR,
            detail="internal server error",
        )
    else:
        set_assemble_status(AssembleTask.ARTIFACTS, org_id, checksum, ChunkFileState.OK)


def assemble_file(task, org_or_project, name, checksum, chunks, file_type):
    """
    Verifies and assembles a file model from chunks.

    This downloads all chunks from blob store to verify their integrity and
    associates them with a created file model. Additionally, it assembles the
    full file in a temporary location and verifies the complete content hash.

    Returns a tuple ``(File, TempFile)`` on success, or ``None`` on error.
    """
    from sentry.models import AssembleChecksumMismatch, File, FileBlob, Project

    if isinstance(org_or_project, Project):
        organization = org_or_project.organization
    else:
        organization = org_or_project

    # Load all FileBlobs from db since we can be sure here we already own all
    # chunks need to build the file
    file_blobs = FileBlob.objects.filter(checksum__in=chunks).values_list("id", "checksum", "size")

    # Reject all files that exceed the maximum allowed size for this
    # organization. This value cannot be
    file_size = sum(x[2] for x in file_blobs)
    if file_size > get_max_file_size(organization):
        set_assemble_status(
            task,
            org_or_project.id,
            checksum,
            ChunkFileState.ERROR,
            detail="File exceeds maximum size",
        )
        return

    # Sanity check.  In case not all blobs exist at this point we have a
    # race condition.
    if {x[1] for x in file_blobs} != set(chunks):
        set_assemble_status(
            task,
            org_or_project.id,
            checksum,
            ChunkFileState.ERROR,
            detail="Not all chunks available for assembling",
        )
        return

    # Ensure blobs are in the order and duplication in which they were
    # transmitted. Otherwise, we would assemble the file in the wrong order.
    ids_by_checksum = {chks: id for id, chks, _ in file_blobs}
    file_blob_ids = [ids_by_checksum[c] for c in chunks]

    file = File.objects.create(name=name, checksum=checksum, type=file_type)
    try:
        temp_file = file.assemble_from_file_blob_ids(file_blob_ids, checksum)
    except AssembleChecksumMismatch:
        file.delete()
        set_assemble_status(
            task,
            org_or_project.id,
            checksum,
            ChunkFileState.ERROR,
            detail="Reported checksum mismatch",
        )
    else:
        file.save()
        return file, temp_file

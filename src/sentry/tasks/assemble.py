from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime
from os import path
from typing import List, Optional, Set, Tuple

import sentry_sdk
from django.db import IntegrityError, router
from django.db.models import Q
from django.utils import timezone
from symbolic.debuginfo import normalize_debug_id
from symbolic.exceptions import SymbolicError

from sentry import analytics, features, options
from sentry.api.serializers import serialize
from sentry.cache import default_cache
from sentry.debug_files.artifact_bundles import index_artifact_bundles_for_release
from sentry.models import File, Organization, Release, ReleaseFile
from sentry.models.artifactbundle import (
    INDEXING_THRESHOLD,
    NULL_STRING,
    ArtifactBundle,
    ArtifactBundleIndexingState,
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
    RELEASE_BUNDLE = "organization.artifacts"  # Release file upload
    ARTIFACT_BUNDLE = "organization.artifact_bundle"  # Artifact bundle upload


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
            file.delete()


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


def _remove_duplicate_artifact_bundles(org_id: int, ids: List[int]):
    # In case there are no ids to delete, we don't want to run the query, otherwise it will result in a deletion of
    # all ArtifactBundle(s) with the specific bundle_id.
    if not ids:
        return

    # Even though we delete via a QuerySet the associated file is also deleted, because django will still
    # fire the on_delete signal.
    ArtifactBundle.objects.filter(Q(id__in=ids), organization_id=org_id).delete()


def _bind_or_create_artifact_bundle(
    bundle_id: str | None,
    date_added: datetime,
    org_id: int,
    archive_file: File,
    artifact_count: int,
) -> Tuple[ArtifactBundle, bool]:
    existing_artifact_bundles = list(
        ArtifactBundle.objects.filter(organization_id=org_id, bundle_id=bundle_id)
    )

    if len(existing_artifact_bundles) == 0:
        existing_artifact_bundle = None
    else:
        existing_artifact_bundle = existing_artifact_bundles.pop()
        # We want to remove all the duplicate artifact bundles that have the same bundle_id.
        _remove_duplicate_artifact_bundles(
            org_id=org_id, ids=list(map(lambda value: value.id, existing_artifact_bundles))
        )

    # In case there is not ArtifactBundle with a specific bundle_id, we just create it and return.
    if existing_artifact_bundle is None:
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=org_id,
            # In case we didn't find the bundle_id in the manifest, we will just generate our own.
            bundle_id=bundle_id or uuid.uuid4().hex,
            file=archive_file,
            artifact_count=artifact_count,
            # By default, a bundle is not indexed.
            indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
            # "date_added" and "date_uploaded" will have the same value, but they will diverge once renewal is performed
            # by other parts of Sentry. Renewal is required since we want to expire unused bundles after ~90 days.
            date_added=date_added,
            date_uploaded=date_added,
            # When creating a new bundle by default its last modified date corresponds to the creation date.
            date_last_modified=date_added,
        )

        return artifact_bundle, True
    else:
        # We store a reference to the previous file to which the bundle was pointing to.
        existing_file = existing_artifact_bundle.file

        # Only if the file objects are different we want to update the database, otherwise we will end up deleting
        # a newly bound file.
        if existing_file != archive_file:
            # In case there is an ArtifactBundle with a specific bundle_id, we want to change its underlying File model
            # with its corresponding artifact count and also update the dates.
            existing_artifact_bundle.update(
                file=archive_file,
                artifact_count=artifact_count,
                date_added=date_added,
                # If you upload a bundle which already exists, we track this as a modification since our goal is to show
                # first all the bundles that have had the most recent activity.
                date_last_modified=date_added,
            )

            # We now delete that file, in order to avoid orphan files in the database.
            existing_file.delete()

        return existing_artifact_bundle, False


def _index_bundle_if_needed(org_id: int, release: str, dist: str, date_snapshot: datetime):
    # We collect how many times we tried to perform indexing.
    metrics.incr("tasks.assemble.artifact_bundle.try_indexing")

    # We get the number of associations by upper bounding the query to the "date_snapshot", which is done to prevent
    # the case in which concurrent updates on the database will lead to problems. For example if we have a threshold
    # of 1, and we have two uploads happening concurrently and the database will contain two associations even when
    # the assembling of the first upload is running this query, we will have the first upload task see 2 associations
    # , thus it will trigger the indexing. The same will also happen for the second upload but in reality we just
    # want the second upload to perform indexing.
    #
    # This date implementation might still lead to issues, more specifically in the case in which the
    # "date_last_modified" is the same but the probability of that happening is so low that it's a negligible
    # detail for now, as long as the indexing is idempotent.
    associated_bundles = list(
        ArtifactBundle.objects.filter(
            organization_id=org_id,
            # Since the `date_snapshot` will be the same as `date_last_modified` of the last bundle uploaded in this
            # async job, we want to use the `<=` condition for time, effectively saying give me all the bundles that
            # were created now or in the past.
            date_last_modified__lte=date_snapshot,
            releaseartifactbundle__release_name=release,
            releaseartifactbundle__dist_name=dist,
        )
    )

    # In case we didn't surpass the threshold, indexing will not happen.
    if len(associated_bundles) <= INDEXING_THRESHOLD:
        return

    # We collect how many times we run indexing.
    metrics.incr("tasks.assemble.artifact_bundle.start_indexing")

    # We collect how many bundles we are going to index.
    metrics.incr("tasks.assemble.artifact_bundle.bundles_to_index", amount=len(associated_bundles))

    # We want to measure how much time it takes to perform indexing.
    with metrics.timer("tasks.assemble.artifact_bundle.index_bundles"):
        # We now call the indexing logic with all the bundles that require indexing. We might need to make this call
        # async if we see a performance degradation of assembling.
        try:
            index_artifact_bundles_for_release(
                organization_id=org_id,
                artifact_bundles=associated_bundles,
                release=release,
                dist=dist,
            )
        except Exception as e:
            # We want to capture any exception happening during indexing, since it's crucial to understand if
            # the system is behaving well because the database can easily end up in an inconsistent state.
            metrics.incr("tasks.assemble.artifact_bundle.indexing_error")
            sentry_sdk.capture_exception(e)


def _create_artifact_bundle(
    release: Optional[str],
    dist: Optional[str],
    org_id: int,
    project_ids: Optional[List[int]],
    archive_file: File,
    artifact_count: int,
) -> None:
    with ReleaseArchive(archive_file.getfile()) as archive:
        # We want to measure how much time it takes to extract debug ids from manifest.
        with metrics.timer("tasks.assemble.artifact_bundle.extract_debug_ids"):
            bundle_id, debug_ids_with_types = _extract_debug_ids_from_manifest(archive.manifest)

        analytics.record(
            "artifactbundle.manifest_extracted",
            organization_id=org_id,
            project_ids=project_ids,
            has_debug_ids=len(debug_ids_with_types) > 0,
        )

        # We want to save an artifact bundle only if we have found debug ids in the manifest or if the user specified
        # a release for the upload.
        if len(debug_ids_with_types) > 0 or release:
            # We take a snapshot in time in order to have consistent values in the database.
            date_snapshot = timezone.now()

            # We have to add this dictionary to both `values` and `defaults` since we want to update the date_added in
            # case of a re-upload because the `date_added` of the ArtifactBundle is also updated.
            new_date_added = {"date_added": date_snapshot}

            # Since dist is non-nullable in the db, but we actually use a sentinel value to represent nullability, here
            # we have to do the conversion in case it is "None".
            dist = dist or NULL_STRING
            release = release or NULL_STRING

            # We want to run everything in a transaction, since we don't want the database to be in an inconsistent
            # state after all of these updates.
            with atomic_transaction(
                using=(
                    router.db_for_write(ArtifactBundle),
                    router.db_for_write(File),
                    router.db_for_write(ReleaseArtifactBundle),
                    router.db_for_write(ProjectArtifactBundle),
                    router.db_for_write(DebugIdArtifactBundle),
                )
            ):
                artifact_bundle, created = _bind_or_create_artifact_bundle(
                    bundle_id=bundle_id,
                    date_added=date_snapshot,
                    org_id=org_id,
                    archive_file=archive_file,
                    artifact_count=artifact_count,
                )

                # If a release version is passed, we want to create the weak association between a bundle and a release.
                if release:
                    ReleaseArtifactBundle.objects.create_or_update(
                        organization_id=org_id,
                        release_name=release,
                        # In case no dist is provided, we will fall back to "" which is the NULL equivalent for our
                        # tables.
                        dist_name=dist,
                        artifact_bundle=artifact_bundle,
                        values=new_date_added,
                        defaults=new_date_added,
                    )

                for project_id in project_ids or ():
                    ProjectArtifactBundle.objects.create_or_update(
                        organization_id=org_id,
                        project_id=project_id,
                        artifact_bundle=artifact_bundle,
                        values=new_date_added,
                        defaults=new_date_added,
                    )

                for source_file_type, debug_id in debug_ids_with_types:
                    DebugIdArtifactBundle.objects.create_or_update(
                        organization_id=org_id,
                        debug_id=debug_id,
                        artifact_bundle=artifact_bundle,
                        source_file_type=source_file_type.value,
                        values=new_date_added,
                        defaults=new_date_added,
                    )

            try:
                organization = Organization.objects.get_from_cache(id=org_id)
            except Organization.DoesNotExist:
                organization = None

            # If we don't have a release set, we don't want to run indexing, since we need at least the release for
            # fast indexing performance. We might though run indexing if a customer has debug ids in the manifest, since
            # we want to have a fallback mechanism in case they have problems setting them up (e.g., SDK version does
            # not support them, some files were not injected...).
            if (
                organization is not None
                and release
                and features.has(
                    "organizations:sourcemaps-bundle-indexing", organization, actor=None
                )
            ):
                # After we committed the transaction we want to try and run indexing.
                _index_bundle_if_needed(
                    org_id=org_id, release=release, dist=dist, date_snapshot=date_snapshot
                )
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
        release=version,
        dist=dist,
        org_id=organization.id,
        project_ids=project_ids,
        archive_file=bundle,
        artifact_count=archive.artifact_count,
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

    # We want to evaluate the type of assemble task given the input parameters.
    assemble_task = (
        AssembleTask.ARTIFACT_BUNDLE if upload_as_artifact_bundle else AssembleTask.RELEASE_BUNDLE
    )

    try:
        organization = Organization.objects.get_from_cache(pk=org_id)
        bind_organization_context(organization)

        set_assemble_status(assemble_task, org_id, checksum, ChunkFileState.ASSEMBLING)

        archive_name = "bundle-artifacts" if upload_as_artifact_bundle else "release-artifacts"
        archive_filename = f"{archive_name}-{uuid.uuid4().hex}.zip"
        file_type = "artifact.bundle" if upload_as_artifact_bundle else "release.bundle"

        # Assemble the chunks into a temporary file
        rv = assemble_file(
            assemble_task,
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
            archive = ReleaseArchive(temp_file)
        except Exception:
            raise AssembleArtifactsError("failed to open release manifest")

        with archive:
            if upload_as_artifact_bundle:
                with metrics.timer("tasks.assemble.artifact_bundle"):
                    handle_assemble_for_artifact_bundle(
                        bundle, archive, organization, version, dist, project_ids
                    )
            else:
                with metrics.timer("tasks.assemble.release_bundle"):
                    handle_assemble_for_release_file(bundle, archive, organization, version)

            metrics.incr("tasks.assemble.extracted_files", amount=archive.artifact_count)
    except AssembleArtifactsError as e:
        set_assemble_status(assemble_task, org_id, checksum, ChunkFileState.ERROR, detail=str(e))
    except Exception:
        logger.error("failed to assemble release bundle", exc_info=True)
        set_assemble_status(
            assemble_task,
            org_id,
            checksum,
            ChunkFileState.ERROR,
            detail="internal server error",
        )
    else:
        set_assemble_status(assemble_task, org_id, checksum, ChunkFileState.OK)


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

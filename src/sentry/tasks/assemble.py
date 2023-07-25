from __future__ import annotations

import hashlib
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from os import path
from typing import IO, List, NamedTuple, Optional, Tuple

import sentry_sdk
from django.db import IntegrityError, router
from django.db.models import Q
from django.utils import timezone

from sentry import analytics, features, options
from sentry.api.serializers import serialize
from sentry.cache import default_cache
from sentry.debug_files.artifact_bundle_indexing import (
    BundleMeta,
    mark_bundle_for_flat_file_indexing,
    update_artifact_bundle_index,
)
from sentry.debug_files.artifact_bundles import index_artifact_bundles_for_release
from sentry.models import File, Organization, Release, ReleaseFile
from sentry.models.artifactbundle import (
    INDEXING_THRESHOLD,
    NULL_STRING,
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleIndexingState,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
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


class AssembleResult(NamedTuple):
    # File object stored in the database.
    bundle: File
    # Temporary in-memory object representing the file used for efficiency.
    bundle_temp_file: IO

    def delete_bundle(self):
        self.bundle.delete()
        self.bundle_temp_file.close()


@sentry_sdk.tracing.trace
def assemble_file(
    task, org_or_project, name, checksum, chunks, file_type
) -> Optional[AssembleResult]:
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

    # Load all FileBlobs from db since we can be sure here we already own all chunks need to build the file.
    file_blobs = FileBlob.objects.filter(checksum__in=chunks).values_list("id", "checksum", "size")

    # Reject all files that exceed the maximum allowed size for this organization.
    file_size = sum(x[2] for x in file_blobs)
    if file_size > get_max_file_size(organization):
        set_assemble_status(
            task,
            org_or_project.id,
            checksum,
            ChunkFileState.ERROR,
            detail="File exceeds maximum size",
        )

        return None

    # Sanity check. In case not all blobs exist at this point we have a race condition.
    if {x[1] for x in file_blobs} != set(chunks):
        # Most likely a previous check to `find_missing_chunks` or similar
        # reported a chunk exists by its checksum, but now it does not
        # exist anymore
        logger.error("`FileBlob` disappeared during async `assemble_XXX` task")

        set_assemble_status(
            task,
            org_or_project.id,
            checksum,
            ChunkFileState.ERROR,
            detail="Not all chunks available for assembling",
        )

        return None

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
        return None
    else:
        file.save()

        return AssembleResult(bundle=file, bundle_temp_file=temp_file)


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
    from sentry.lang.native.sources import record_last_upload
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
            # We only permit split difs to hit this endpoint.
            # The client is required to split them up first or we error.
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
                record_last_upload(project)
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


class PostAssembler(ABC):
    def __init__(self, assemble_result: AssembleResult):
        self.assemble_result = assemble_result
        self._validate_bundle_guarded()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # In case any exception happens in the `with` block, we will capture it, and we want to delete the actual `File`
        # object created in the database, to avoid orphan entries.
        if exc_type is not None:
            self._delete_bundle_file_object()

        self.close()

    def _delete_bundle_file_object(self):
        self.assemble_result.delete_bundle()

    def _validate_bundle_guarded(self):
        try:
            self._validate_bundle()
        except Exception:
            metrics.incr("tasks.assemble.invalid_bundle")
            # In case the bundle is invalid, we want to delete the actual `File` object created in the database, to
            # avoid orphan entries.
            self._delete_bundle_file_object()
            raise AssembleArtifactsError("the bundle is invalid")

    @abstractmethod
    def _validate_bundle(self):
        pass

    @abstractmethod
    def close(self):
        pass

    @abstractmethod
    def post_assemble(self):
        pass


class ReleaseBundlePostAssembler(PostAssembler):
    def __init__(self, assemble_result: AssembleResult, organization: Organization, version: str):
        super().__init__(assemble_result)
        self.organization = organization
        self.version = version

    def _validate_bundle(self):
        self.archive = ReleaseArchive(self.assemble_result.bundle_temp_file)
        metrics.incr(
            "tasks.assemble.release_bundle.artifact_count", amount=self.archive.artifact_count
        )

    def close(self):
        self.archive.close()

    def post_assemble(self):
        with metrics.timer("tasks.assemble.release_bundle"):
            self._create_release_file()

    @sentry_sdk.tracing.trace
    def _create_release_file(self):
        manifest = self.archive.manifest

        if manifest.get("org") != self.organization.slug:
            raise AssembleArtifactsError("organization does not match uploaded bundle")

        if manifest.get("release") != self.version:
            raise AssembleArtifactsError("release does not match uploaded bundle")

        try:
            release = Release.objects.get(
                organization_id=self.organization.id, version=self.version
            )
        except Release.DoesNotExist:
            raise AssembleArtifactsError("release does not exist")

        dist_name = manifest.get("dist")
        dist = release.add_dist(dist_name) if dist_name else None

        min_artifact_count = options.get("processing.release-archive-min-files")
        saved_as_archive = False

        if self.archive.artifact_count >= min_artifact_count:
            try:
                update_artifact_index(
                    release,
                    dist,
                    self.assemble_result.bundle,
                    self.assemble_result.bundle_temp_file,
                )
                metrics.incr("sourcemaps.upload.release_bundle")
                saved_as_archive = True
            except Exception as exc:
                logger.error("Unable to update artifact index", exc_info=exc)

        if not saved_as_archive:
            meta = {
                "organization_id": self.organization.id,
                "release_id": release.id,
                "dist_id": dist.id if dist else dist,
            }
            metrics.incr("sourcemaps.upload.release_file")
            self._store_single_files(meta, True)

    @sentry_sdk.tracing.trace
    def _store_single_files(self, meta: dict, count_as_artifacts: bool):
        try:
            temp_dir = self.archive.extract()
        except Exception:
            raise AssembleArtifactsError("failed to extract bundle")

        with temp_dir:
            artifacts = self.archive.manifest.get("files", {})
            for rel_path, artifact in artifacts.items():
                artifact_url = artifact.get("url", rel_path)
                artifact_basename = self._get_artifact_basename(artifact_url)

                file = File.objects.create(
                    name=artifact_basename, type="release.file", headers=artifact.get("headers", {})
                )

                full_path = path.join(temp_dir.name, rel_path)
                with open(full_path, "rb") as fp:
                    file.putfile(fp, logger=logger)

                kwargs = dict(meta, name=artifact_url)
                extra_fields = {"artifact_count": 1 if count_as_artifacts else 0}
                self._upsert_release_file(file, self._simple_update, kwargs, extra_fields)

    @staticmethod
    def _get_artifact_basename(url):
        return url.rsplit("/", 1)[-1]

    @staticmethod
    def _upsert_release_file(file: File, update_fn, key_fields, additional_fields) -> bool:
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
            success = update_fn(release_file, file, additional_fields)

        return success

    @staticmethod
    def _simple_update(release_file: ReleaseFile, new_file: File, additional_fields: dict) -> bool:
        """Update function used in _upsert_release_file"""
        old_file = release_file.file
        release_file.update(file=new_file, **additional_fields)
        old_file.delete()

        return True


class ArtifactBundlePostAssembler(PostAssembler):
    def __init__(
        self,
        assemble_result: AssembleResult,
        organization: Organization,
        release: Optional[str],
        dist: Optional[str],
        project_ids: List[int],
    ):
        super().__init__(assemble_result)
        self.organization = organization
        self.release = release
        self.dist = dist
        self.project_ids = project_ids

    def _validate_bundle(self):
        self.archive = ArtifactBundleArchive(self.assemble_result.bundle_temp_file)
        metrics.incr(
            "tasks.assemble.artifact_bundle.artifact_count", amount=self.archive.artifact_count
        )

    def close(self):
        self.archive.close()

    def post_assemble(self):
        with metrics.timer("tasks.assemble.artifact_bundle"):
            self._create_artifact_bundle()

    @sentry_sdk.tracing.trace
    def _create_artifact_bundle(self) -> None:
        # We want to give precedence to the request fields and only if they are unset fallback to the manifest's
        # contents.
        self.release = self.release or self.archive.manifest.get("release")
        self.dist = self.dist or self.archive.manifest.get("dist")

        # We want to measure how much time it takes to extract debug ids from manifest.
        with metrics.timer("tasks.assemble.artifact_bundle.extract_debug_ids"):
            debug_ids_with_types = self.archive.extract_debug_ids_from_manifest()

        bundle_id = self.archive.extract_bundle_id()
        if not bundle_id:
            # In case we didn't find the bundle_id in the manifest, we will just generate our own.
            bundle_id = ArtifactBundleArchive.normalize_debug_id(
                self.assemble_result.bundle.checksum
            )
        # When normalizing the debug_id from the checksum, or even when reading it from the bundle,
        # the debug_id can have an additional appendix which we want to remove as it is
        # incompatible with the SQL `uuid` type, which expects this to be a 16-byte UUID,
        # formatted with `-` to 36 chars.
        bundle_id = bundle_id[:36] if bundle_id else uuid.uuid4().hex

        analytics.record(
            "artifactbundle.manifest_extracted",
            organization_id=self.organization.id,
            project_ids=self.project_ids,
            has_debug_ids=len(debug_ids_with_types) > 0,
        )

        # We don't allow the creation of a bundle if no debug ids and release are present, since we are not able to
        # efficiently index
        if len(debug_ids_with_types) == 0 and not self.release:
            raise AssembleArtifactsError(
                "uploading a bundle without debug ids or release is prohibited"
            )

        # We take a snapshot in time in order to have consistent values in the database.
        date_snapshot = timezone.now()

        # We have to add this dictionary to both `values` and `defaults` since we want to update the date_added in
        # case of a re-upload because the `date_added` of the ArtifactBundle is also updated.
        new_date_added = {"date_added": date_snapshot}

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
            artifact_bundle, created = self._create_or_update_artifact_bundle(
                bundle_id=bundle_id, date_added=date_snapshot
            )

            # If a release version is passed, we want to create the weak association between a bundle and a release.
            if self.release:
                ReleaseArtifactBundle.objects.create_or_update(
                    organization_id=self.organization.id,
                    release_name=self.release,
                    # In case no dist is provided, we will fall back to "" which is the NULL equivalent for our
                    # tables.
                    dist_name=self.dist or NULL_STRING,
                    artifact_bundle=artifact_bundle,
                    values=new_date_added,
                    defaults=new_date_added,
                )

            for project_id in self.project_ids:
                ProjectArtifactBundle.objects.create_or_update(
                    organization_id=self.organization.id,
                    project_id=project_id,
                    artifact_bundle=artifact_bundle,
                    values=new_date_added,
                    defaults=new_date_added,
                )

            # Instead of doing a `create_or_update` one-by-one, we will instead:
            # - Use a `bulk_create` with `ignore_conflicts` to insert new rows efficiently
            #   if the artifact bundle was newly inserted. This is based on the assumption
            #   that the `bundle_id` is deterministic and the `created` flag signals that
            #   this identical bundle was already inserted.
            # - Otherwise, update all the affected/conflicting rows with a single query.
            if created:
                debug_id_to_insert = [
                    DebugIdArtifactBundle(
                        organization_id=self.organization.id,
                        debug_id=debug_id,
                        artifact_bundle=artifact_bundle,
                        source_file_type=source_file_type.value,
                        date_added=date_snapshot,
                    )
                    for source_file_type, debug_id in debug_ids_with_types
                ]
                DebugIdArtifactBundle.objects.bulk_create(
                    debug_id_to_insert, batch_size=50, ignore_conflicts=True
                )
            else:
                DebugIdArtifactBundle.objects.filter(
                    organization_id=self.organization.id,
                    artifact_bundle=artifact_bundle,
                ).update(date_added=date_snapshot)

        metrics.incr("sourcemaps.upload.artifact_bundle")

        # If we don't have a release set, we don't want to run indexing, since we need at least the release for
        # fast indexing performance. We might though run indexing if a customer has debug ids in the manifest, since
        # we want to have a fallback mechanism in case they have problems setting them up (e.g., SDK version does
        # not support them, some files were not injected...).
        if self.release:
            # After we committed the transaction we want to try and run indexing by passing non-null release and
            # dist. The dist here can be "" since it will be the equivalent of NULL for the db query.
            self._index_bundle_if_needed(
                release=self.release,
                dist=(self.dist or NULL_STRING),
                date_snapshot=date_snapshot,
            )

        if features.has("organizations:sourcemaps-bundle-flat-file-indexing", self.organization):
            try:
                self._index_bundle_into_flat_file(artifact_bundle)
            except Exception as e:
                sentry_sdk.capture_exception(e)

    @sentry_sdk.tracing.trace
    def _create_or_update_artifact_bundle(
        self, bundle_id: str, date_added: datetime
    ) -> Tuple[ArtifactBundle, bool]:
        existing_artifact_bundles = list(
            ArtifactBundle.objects.filter(organization_id=self.organization.id, bundle_id=bundle_id)
        )

        if len(existing_artifact_bundles) == 0:
            existing_artifact_bundle = None
        else:
            existing_artifact_bundle = existing_artifact_bundles.pop()
            # We want to remove all the duplicate artifact bundles that have the same bundle_id.
            self._remove_duplicate_artifact_bundles(
                ids=list(map(lambda value: value.id, existing_artifact_bundles))
            )

        # In case there is not ArtifactBundle with a specific bundle_id, we just create it and return.
        if existing_artifact_bundle is None:
            artifact_bundle = ArtifactBundle.objects.create(
                organization_id=self.organization.id,
                bundle_id=bundle_id,
                file=self.assemble_result.bundle,
                artifact_count=self.archive.artifact_count,
                # By default, a bundle is not indexed.
                indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
                # "date_added" and "date_uploaded" will have the same value, but they will diverge once renewal is
                # performed by other parts of Sentry. Renewal is required since we want to expire unused bundles
                # after ~90 days.
                date_added=date_added,
                date_uploaded=date_added,
                # When creating a new bundle by default its last modified date corresponds to the creation date.
                date_last_modified=date_added,
            )

            return artifact_bundle, True
        else:
            # We store a reference to the previous file to which the bundle was pointing to.
            existing_file = existing_artifact_bundle.file

            # FIXME: We might want to get this error, but it currently blocks deploys
            # if existing_file.checksum != self.assemble_result.bundle.checksum:
            #    logger.error("Detected duplicated `ArtifactBundle` with differing checksums")

            # Only if the file objects are different we want to update the database, otherwise we will end up deleting
            # a newly bound file.
            if existing_file != self.assemble_result.bundle:
                # In case there is an ArtifactBundle with a specific bundle_id, we want to change its underlying File
                # model with its corresponding artifact count and also update the dates.
                existing_artifact_bundle.update(
                    file=self.assemble_result.bundle,
                    artifact_count=self.archive.artifact_count,
                    date_added=date_added,
                    # If you upload a bundle which already exists, we track this as a modification since our goal is
                    # to show first all the bundles that have had the most recent activity.
                    date_last_modified=date_added,
                )

                # We now delete that file, in order to avoid orphan files in the database.
                existing_file.delete()
            # else: are we leaking the `assemble_result.bundle` in this case?

            return existing_artifact_bundle, False

    def _remove_duplicate_artifact_bundles(self, ids: List[int]):
        # In case there are no ids to delete, we don't want to run the query, otherwise it will result in a deletion of
        # all ArtifactBundle(s) with the specific bundle_id.
        if not ids:
            return

        # Even though we delete via a QuerySet the associated file is also deleted, because django will still
        # fire the on_delete signal.
        ArtifactBundle.objects.filter(Q(id__in=ids), organization_id=self.organization.id).delete()

    @sentry_sdk.tracing.trace
    def _index_bundle_if_needed(self, release: str, dist: str, date_snapshot: datetime):
        # We collect how many times we tried to perform indexing.
        metrics.incr("tasks.assemble.artifact_bundle.try_indexing")

        # We get the number of associations by upper bounding the query to the "date_snapshot", which is done to
        # prevent the case in which concurrent updates on the database will lead to problems. For example if we have
        # a threshold of 1, and we have two uploads happening concurrently and the database will contain two
        # associations even when the assembling of the first upload is running this query, we will have the first
        # upload task see 2 associations , thus it will trigger the indexing. The same will also happen for the
        # second upload but in reality we just want the second upload to perform indexing.
        #
        # This date implementation might still lead to issues, more specifically in the case in which the
        # "date_last_modified" is the same but the probability of that happening is so low that it's a negligible
        # detail for now, as long as the indexing is idempotent.
        associated_bundles = list(
            ArtifactBundle.objects.filter(
                releaseartifactbundle__organization_id=self.organization.id,
                releaseartifactbundle__release_name=release,
                releaseartifactbundle__dist_name=dist,
                # Since the `date_snapshot` will be the same as `date_last_modified` of the last bundle uploaded in this
                # async job, we want to use the `<=` condition for time, effectively saying give me all the bundles that
                # were created now or in the past.
                date_last_modified__lte=date_snapshot,
            )
        )

        # In case we didn't surpass the threshold, indexing will not happen.
        if len(associated_bundles) <= INDEXING_THRESHOLD:
            return

        # We collect how many times we run indexing.
        metrics.incr("tasks.assemble.artifact_bundle.start_indexing")

        # We want to measure how much time it takes to perform indexing.
        with metrics.timer("tasks.assemble.artifact_bundle.index_bundles"):
            # We now call the indexing logic with all the bundles that require indexing. We might need to make this call
            # async if we see a performance degradation of assembling.
            try:
                # We only want to get the bundles that are not indexed. Keep in mind that this query is concurrency
                # unsafe since in the meanwhile the bundles might be modified and the modification will not be
                # reflected in the objects that we are iterating here.
                #
                # In case of concurrency issues, we might do extra work but due to the idempotency of the indexing
                # function no consistency issues should arise.
                bundles_to_index = [
                    associated_bundle
                    for associated_bundle in associated_bundles
                    if associated_bundle.indexing_state
                    == ArtifactBundleIndexingState.NOT_INDEXED.value
                ]

                # We want to index only if we have bundles to index.
                if len(bundles_to_index) > 0:
                    index_artifact_bundles_for_release(
                        organization_id=self.organization.id,
                        artifact_bundles=bundles_to_index,
                        release=release,
                        dist=dist,
                    )
            except Exception as e:
                # We want to capture any exception happening during indexing, since it's crucial to understand if
                # the system is behaving well because the database can easily end up in an inconsistent state.
                metrics.incr("tasks.assemble.artifact_bundle.index_artifact_bundles_error")
                sentry_sdk.capture_exception(e)

    @sentry_sdk.tracing.trace
    def _index_bundle_into_flat_file(self, artifact_bundle: ArtifactBundle):
        identifiers = mark_bundle_for_flat_file_indexing(
            artifact_bundle, self.project_ids, self.release, self.dist
        )

        bundle_meta = BundleMeta(
            id=artifact_bundle.id,
            # We give priority to the date last modified for total ordering.
            timestamp=(artifact_bundle.date_last_modified or artifact_bundle.date_uploaded),
        )

        for identifier in identifiers:
            try:
                update_artifact_bundle_index(bundle_meta, self.archive, identifier)
            except Exception as e:
                metrics.incr("artifact_bundle_flat_file_indexing.error_when_indexing")
                sentry_sdk.capture_exception(e)


def prepare_post_assembler(
    assemble_result: AssembleResult,
    organization: Organization,
    release: Optional[str],
    dist: Optional[str],
    project_ids: Optional[List[int]],
    upload_as_artifact_bundle: bool,
) -> PostAssembler:
    if upload_as_artifact_bundle:
        if not project_ids:
            raise AssembleArtifactsError(
                "uploading an artifact bundle without a project is prohibited"
            )
        return ArtifactBundlePostAssembler(
            assemble_result=assemble_result,
            organization=organization,
            release=release,
            dist=dist,
            project_ids=project_ids,
        )
    else:
        if not release:
            raise AssembleArtifactsError(
                "uploading a release bundle without a release is prohibited"
            )
        return ReleaseBundlePostAssembler(
            assemble_result=assemble_result, organization=organization, version=release
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
        assemble_result = assemble_file(
            task=assemble_task,
            org_or_project=organization,
            name=archive_filename,
            checksum=checksum,
            chunks=chunks,
            file_type=file_type,
        )

        # If not file has been created this means that the file failed to assemble because of bad input data.
        # In this case, assemble_file has set the assemble status already.
        if assemble_result is None:
            return

        # We first want to prepare the post assembler which will take care of validating the archive.
        with prepare_post_assembler(
            assemble_result=assemble_result,
            organization=organization,
            release=version,
            dist=dist,
            project_ids=project_ids,
            upload_as_artifact_bundle=upload_as_artifact_bundle,
        ) as post_assembler:
            # Once the archive is valid, the post assembler can run the post assembling job.
            post_assembler.post_assemble()
    except AssembleArtifactsError as e:
        set_assemble_status(assemble_task, org_id, checksum, ChunkFileState.ERROR, detail=str(e))
    except Exception as e:
        logger.error("failed to assemble bundle", exc_info=True)
        sentry_sdk.capture_exception(e)
        set_assemble_status(
            assemble_task,
            org_id,
            checksum,
            ChunkFileState.ERROR,
            detail="internal server error",
        )
    else:
        set_assemble_status(assemble_task, org_id, checksum, ChunkFileState.OK)

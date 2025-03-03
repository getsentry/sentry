from __future__ import annotations

import hashlib
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from os import path
from typing import IO, TYPE_CHECKING, Generic, NamedTuple, Protocol, TypeVar

import orjson
import sentry_sdk
from django.conf import settings
from django.db import IntegrityError, router
from django.db.models import Q
from django.utils import timezone

from sentry import options
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.debug_files.artifact_bundles import (
    INDEXING_THRESHOLD,
    get_bundles_indexing_state,
    index_artifact_bundles_for_release,
)
from sentry.debug_files.tasks import backfill_artifact_bundle_db_indexing
from sentry.models.artifactbundle import (
    NULL_STRING,
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleIndexingState,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
)
from sentry.models.files.file import File
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasefile import ReleaseArchive, ReleaseFile, update_artifact_index
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, redis
from sentry.utils.db import atomic_transaction
from sentry.utils.files import get_max_file_size
from sentry.utils.sdk import Scope, bind_organization_context

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from rediscluster import RedisCluster


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
def assemble_file(task, org_or_project, name, checksum, chunks, file_type) -> AssembleResult | None:
    """
    Verifies and assembles a file model from chunks.

    This downloads all chunks from blob store to verify their integrity and
    associates them with a created file model. Additionally, it assembles the
    full file in a temporary location and verifies the complete content hash.

    Returns a tuple ``(File, TempFile)`` on success, or ``None`` on error.
    """
    from sentry.models.files.fileblob import FileBlob
    from sentry.models.files.utils import AssembleChecksumMismatch

    if isinstance(org_or_project, Project):
        organization = org_or_project.organization
    else:
        organization = org_or_project

    # Load all FileBlobs from db since we can be sure here we already own all chunks need to build the file.
    #
    # To guarantee that the blobs are owned by the org which is building this file, we check the ownership when checking
    # the blobs.
    file_blobs = FileBlob.objects.filter(
        checksum__in=chunks, fileblobowner__organization_id=organization.id
    ).values_list("id", "checksum", "size")

    # Reject all files that exceed the maximum allowed size for this organization.
    file_size = sum(size for _, _, size in file_blobs if size is not None)
    max_file_size = get_max_file_size(organization)
    if file_size > max_file_size:
        set_assemble_status(
            task,
            org_or_project.id,
            checksum,
            ChunkFileState.ERROR,
            detail=f"File {name} exceeds maximum size ({file_size} > {max_file_size})",
        )

        return None

    # Sanity check. In case not all blobs exist at this point we have a race condition.
    if {checksum for _, checksum, _ in file_blobs} != set(chunks):
        # Most likely a previous check to `find_missing_chunks` or similar
        # reported a chunk exists by its checksum, but now it does not
        # exist anymore
        logger.error(
            "Not all chunks are available for assembly; they may have been removed or are not associated with the organization."
        )

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
                str(task).encode(),
            )
        ).hexdigest()
    )


def _get_redis_cluster_for_assemble() -> RedisCluster:
    cluster_key = settings.SENTRY_ASSEMBLE_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]


@sentry_sdk.tracing.trace
def get_assemble_status(task, scope, checksum):
    """
    Checks the current status of an assembling task.

    Returns a tuple in the form ``(status, details)``, where ``status`` is the
    ChunkFileState, and ``details`` is either None or a string containing a
    notice or error message.
    """
    cache_key = _get_cache_key(task, scope, checksum)
    client = _get_redis_cluster_for_assemble()
    rv = client.get(cache_key)

    if rv is None:
        return None, None

    # It is stored as bytes with [state, detail] on Redis.
    return tuple(orjson.loads(rv))


@sentry_sdk.tracing.trace
def set_assemble_status(task, scope, checksum, state, detail=None):
    """
    Updates the status of an assembling task. It is cached for 10 minutes.
    """
    cache_key = _get_cache_key(task, scope, checksum)
    redis_client = _get_redis_cluster_for_assemble()
    redis_client.set(name=cache_key, value=orjson.dumps([state, detail]), ex=600)


@sentry_sdk.tracing.trace
def delete_assemble_status(task, scope, checksum):
    """
    Deletes the status of an assembling task.
    """
    cache_key = _get_cache_key(task, scope, checksum)
    redis_client = _get_redis_cluster_for_assemble()
    redis_client.delete(cache_key)


@instrumented_task(
    name="sentry.tasks.assemble.assemble_dif",
    queue="assemble",
    silo_mode=SiloMode.REGION,
)
def assemble_dif(project_id, name, checksum, chunks, debug_id=None, **kwargs):
    """
    Assembles uploaded chunks into a ``ProjectDebugFile``.
    """
    from sentry.lang.native.sources import record_last_upload
    from sentry.models.debugfile import BadDif, create_dif_from_id, detect_dif_from_path
    from sentry.models.project import Project

    Scope.get_isolation_scope().set_tag("project", project_id)

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
                result = detect_dif_from_path(temp_file.name, name=name, debug_id=debug_id)
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

            dif, created = create_dif_from_id(project, result[0], file=file)
            delete_file = False

            if created:
                record_last_upload(project)
    except Exception:
        set_assemble_status(
            AssembleTask.DIF,
            project_id,
            checksum,
            ChunkFileState.ERROR,
            detail="internal server error",
        )
        logger.exception("failed to assemble dif")
    else:
        set_assemble_status(
            AssembleTask.DIF, project_id, checksum, ChunkFileState.OK, detail=serialize(dif)
        )
    finally:
        if delete_file:
            file.delete()


class AssembleArtifactsError(Exception):
    pass


class HasClose(Protocol):
    @abstractmethod
    def close(self):
        pass


TArchive = TypeVar("TArchive", bound=HasClose)


class PostAssembler(Generic[TArchive], ABC):
    archive: TArchive

    def __init__(self, assemble_result: AssembleResult):
        self.assemble_result = assemble_result
        self._validate_bundle_guarded()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # In case any exception happens in the `with` block, we will capture it, and we want to delete the actual `File`
        # object created in the database, to avoid orphan entries.
        if exc_type is not None:
            self.delete_bundle_file_object()

        self.archive.close()

    def delete_bundle_file_object(self):
        self.assemble_result.delete_bundle()

    def _validate_bundle_guarded(self):
        try:
            self._validate_bundle()
        except Exception:
            metrics.incr("tasks.assemble.invalid_bundle")
            # In case the bundle is invalid, we want to delete the actual `File` object created in the database, to
            # avoid orphan entries.
            self.delete_bundle_file_object()
            raise AssembleArtifactsError("the bundle is invalid")

    @abstractmethod
    def _validate_bundle(self):
        pass

    @abstractmethod
    def post_assemble(self):
        pass


class ReleaseBundlePostAssembler(PostAssembler[ReleaseArchive]):
    def __init__(self, assemble_result: AssembleResult, organization: Organization, version: str):
        super().__init__(assemble_result)
        self.organization = organization
        self.version = version

    def _validate_bundle(self):
        self.archive = ReleaseArchive(self.assemble_result.bundle_temp_file)
        metrics.incr(
            "tasks.assemble.release_bundle.artifact_count", amount=self.archive.artifact_count
        )

    def post_assemble(self):
        if self.archive.artifact_count == 0:
            metrics.incr("tasks.assemble.release_bundle.discarded_empty_bundle")
            self.delete_bundle_file_object()
            return
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
                # NOTE: `update_artifact_index` also creates a `ReleaseFile` entry
                # for this bundle.
                update_artifact_index(
                    release,
                    dist,
                    self.assemble_result.bundle,
                    self.assemble_result.bundle_temp_file,
                )
                metrics.incr("sourcemaps.upload.release_bundle")
                saved_as_archive = True
            except Exception:
                logger.exception("Unable to update artifact index")

        if not saved_as_archive:
            meta = {
                "organization_id": self.organization.id,
                "release_id": release.id,
                "dist_id": dist.id if dist else dist,
            }
            metrics.incr("sourcemaps.upload.release_file")
            self._store_single_files(meta)
            # we just extracted the archive and stored it as individual files.
            # there is no reason to keep the file around now anymore.
            self.delete_bundle_file_object()

    @sentry_sdk.tracing.trace
    def _store_single_files(self, meta: dict):
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
                extra_fields = {"artifact_count": 1}
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


class ArtifactBundlePostAssembler(PostAssembler[ArtifactBundleArchive]):
    def __init__(
        self,
        assemble_result: AssembleResult,
        organization: Organization,
        release: str | None,
        dist: str | None,
        project_ids: list[int],
        is_release_bundle_migration: bool = False,
    ):
        super().__init__(assemble_result)
        self.organization = organization
        self.release = release
        self.dist = dist
        self.project_ids = project_ids
        self.is_release_bundle_migration = is_release_bundle_migration

    def _validate_bundle(self):
        self.archive = ArtifactBundleArchive(self.assemble_result.bundle_temp_file)
        metrics.incr(
            "tasks.assemble.artifact_bundle.artifact_count", amount=self.archive.artifact_count
        )

    def post_assemble(self):
        if self.archive.artifact_count == 0:
            metrics.incr("tasks.assemble.artifact_bundle.discarded_empty_bundle")
            self.delete_bundle_file_object()
            return
        with metrics.timer("tasks.assemble.artifact_bundle"):
            self._create_artifact_bundle()

    @sentry_sdk.tracing.trace
    def _create_artifact_bundle(self) -> None:
        # We want to give precedence to the request fields and only if they are unset fallback to the manifest's
        # contents.
        self.release = self.release or self.archive.manifest.get("release")
        self.dist = self.dist or self.archive.manifest.get("dist")

        # In case we have a release bundle migration, we are fetching *all*
        # the projects associated with a release, which can be quite a lot.
        # We rather use the `project` of the bundle manifest instead.
        if len(self.project_ids) > 2 and self.is_release_bundle_migration:
            if project_in_manifest := self.archive.manifest.get("project"):
                project_ids = list(
                    Project.objects.filter(
                        organization=self.organization,
                        status=ObjectStatus.ACTIVE,
                        slug=project_in_manifest,
                    ).values_list("id", flat=True)
                )
                if len(project_ids) > 0:
                    self.project_ids = project_ids

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

        # We don't allow the creation of a bundle if no debug ids and release are present, since we are not able to
        # efficiently index
        if not self.archive.has_debug_ids() and not self.release:
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
                    for debug_id, source_file_type in self.archive.get_all_debug_ids()
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
        if created and self.release:
            # After we committed the transaction we want to try and run indexing by passing non-null release and
            # dist. The dist here can be "" since it will be the equivalent of NULL for the db query.
            self._index_bundle_if_needed(
                artifact_bundle,
                release=self.release,
                dist=(self.dist or NULL_STRING),
            )

    @sentry_sdk.tracing.trace
    def _create_or_update_artifact_bundle(
        self, bundle_id: str, date_added: datetime
    ) -> tuple[ArtifactBundle, bool]:
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

    def _remove_duplicate_artifact_bundles(self, ids: list[int]):
        # In case there are no ids to delete, we don't want to run the query, otherwise it will result in a deletion of
        # all ArtifactBundle(s) with the specific bundle_id.
        if not ids:
            return

        # Even though we delete via a QuerySet the associated file is also deleted, because django will still
        # fire the on_delete signal.
        ArtifactBundle.objects.filter(Q(id__in=ids), organization_id=self.organization.id).delete()

    @sentry_sdk.tracing.trace
    def _index_bundle_if_needed(self, artifact_bundle: ArtifactBundle, release: str, dist: str):
        # We collect how many times we tried to perform indexing.
        metrics.incr("tasks.assemble.artifact_bundle.try_indexing")

        (total_bundles, indexed_bundles) = get_bundles_indexing_state(
            self.organization, release, dist
        )

        # In case we didn't surpass the threshold, indexing will not happen.
        if total_bundles < INDEXING_THRESHOLD:
            return

        # We collect how many times we run indexing.
        metrics.incr("tasks.assemble.artifact_bundle.start_indexing")

        # We want to measure how much time it takes to perform indexing.
        with metrics.timer("tasks.assemble.artifact_bundle.index_bundles"):
            # NOTE: this is doing a try/catch internally
            index_artifact_bundles_for_release(
                organization_id=self.organization.id,
                artifact_bundles=[(artifact_bundle, self.archive)],
            )

        # Backfill older bundles we did not index yet if any are missing
        if indexed_bundles + 1 < total_bundles:
            backfill_artifact_bundle_db_indexing.delay(self.organization.id, release, dist)


def prepare_post_assembler(
    assemble_result: AssembleResult,
    organization: Organization,
    release: str | None,
    dist: str | None,
    project_ids: list[int] | None,
    upload_as_artifact_bundle: bool,
    is_release_bundle_migration: bool,
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
            is_release_bundle_migration=is_release_bundle_migration,
        )
    else:
        if not release:
            raise AssembleArtifactsError(
                "uploading a release bundle without a release is prohibited"
            )
        return ReleaseBundlePostAssembler(
            assemble_result=assemble_result, organization=organization, version=release
        )


@instrumented_task(
    name="sentry.tasks.assemble.assemble_artifacts",
    queue="assemble",
    silo_mode=SiloMode.REGION,
)
def assemble_artifacts(
    org_id,
    version,
    checksum,
    chunks,
    # These params have been added for supporting artifact bundles assembling.
    project_ids=None,
    dist=None,
    upload_as_artifact_bundle=False,
    is_release_bundle_migration=False,
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
            is_release_bundle_migration=is_release_bundle_migration,
        ) as post_assembler:
            # Once the archive is valid, the post assembler can run the post assembling job.
            post_assembler.post_assemble()
    except AssembleArtifactsError as e:
        set_assemble_status(assemble_task, org_id, checksum, ChunkFileState.ERROR, detail=str(e))
    except Exception as e:
        logger.exception("failed to assemble bundle")
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

import hashlib
import logging
from os import path

from django.db import IntegrityError, transaction

from sentry.api.serializers import serialize
from sentry.cache import default_cache
from sentry.tasks.base import instrumented_task
from sentry.utils import json
from sentry.utils.files import get_max_file_size
from sentry.utils.sdk import bind_organization_context, configure_scope

logger = logging.getLogger(__name__)


def enum(**named_values):
    """Creates an enum type."""
    return type("Enum", (), named_values)


ChunkFileState = enum(
    OK="ok",  # File in database
    NOT_FOUND="not_found",  # File not found in database
    CREATED="created",  # File was created in the request and send to the worker for assembling
    ASSEMBLING="assembling",  # File still being processed by worker
    ERROR="error",  # Error happened during assembling
)


AssembleTask = enum(
    DIF="project.dsym",  # Debug file upload
    ARTIFACTS="organization.artifacts",  # Release file upload
)


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
                bump_reprocessing_revision(project)
    except BaseException:
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


@instrumented_task(name="sentry.tasks.assemble.assemble_artifacts", queue="assemble")
def assemble_artifacts(org_id, version, checksum, chunks, **kwargs):
    """
    Creates release files from an uploaded artifact bundle.
    """

    import shutil
    import tempfile

    from sentry.models import File, Organization, Release, ReleaseFile
    from sentry.utils.zip import safe_extract_zip

    scratchpad = None
    delete_bundle = False

    try:
        organization = Organization.objects.get_from_cache(pk=org_id)
        bind_organization_context(organization)

        set_assemble_status(AssembleTask.ARTIFACTS, org_id, checksum, ChunkFileState.ASSEMBLING)

        # Assemble the chunks into a temporary file
        rv = assemble_file(
            AssembleTask.ARTIFACTS,
            organization,
            "release-artifacts.zip",
            checksum,
            chunks,
            file_type="release.bundle",
        )

        # If not file has been created this means that the file failed to
        # assemble because of bad input data. In this case, assemble_file
        # has set the assemble status already.
        if rv is None:
            return

        bundle, temp_file = rv
        scratchpad = tempfile.mkdtemp()

        # Initially, always delete the bundle file. Later on, we can start to store
        # the artifact bundle as a release file.
        delete_bundle = True

        try:
            safe_extract_zip(temp_file, scratchpad, strip_toplevel=False)
        except BaseException:
            raise AssembleArtifactsError("failed to extract bundle")

        try:
            manifest_path = path.join(scratchpad, "manifest.json")
            with open(manifest_path, "rb") as manifest:
                manifest = json.loads(manifest.read())
        except BaseException:
            raise AssembleArtifactsError("failed to open release manifest")

        org_slug = manifest.get("org")
        if organization.slug != org_slug:
            raise AssembleArtifactsError("organization does not match uploaded bundle")

        release_name = manifest.get("release")
        if release_name != version:
            raise AssembleArtifactsError("release does not match uploaded bundle")

        try:
            release = Release.objects.get(organization_id=organization.id, version=release_name)
        except Release.DoesNotExist:
            raise AssembleArtifactsError("release does not exist")

        dist_name = manifest.get("dist")
        dist = None
        if dist_name:
            dist = release.add_dist(dist_name)

        artifacts = manifest.get("files", {})
        for rel_path, artifact in artifacts.items():
            artifact_url = artifact.get("url", rel_path)
            artifact_basename = artifact_url.rsplit("/", 1)[-1]

            file = File.objects.create(
                name=artifact_basename, type="release.file", headers=artifact.get("headers", {})
            )

            full_path = path.join(scratchpad, rel_path)
            with open(full_path, "rb") as fp:
                file.putfile(fp, logger=logger)

            kwargs = {
                "organization_id": organization.id,
                "release": release,
                "name": artifact_url,
                "dist": dist,
            }

            # Release files must have unique names within their release
            # and dist. If a matching file already exists, replace its
            # file with the new one; otherwise create it.
            try:
                release_file = ReleaseFile.objects.get(**kwargs)
            except ReleaseFile.DoesNotExist:
                try:
                    with transaction.atomic():
                        ReleaseFile.objects.create(file=file, **kwargs)
                except IntegrityError:
                    # NB: This indicates a race, where another assemble task or
                    # file upload job has just created a conflicting file. Since
                    # we're upserting here anyway, yield to the faster actor and
                    # do not try again.
                    file.delete()
            else:
                old_file = release_file.file
                release_file.update(file=file)
                old_file.delete()

    except AssembleArtifactsError as e:
        set_assemble_status(
            AssembleTask.ARTIFACTS, org_id, checksum, ChunkFileState.ERROR, detail=str(e)
        )
    except BaseException:
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
    finally:
        if scratchpad:
            shutil.rmtree(scratchpad)
        if delete_bundle:
            bundle.delete()


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

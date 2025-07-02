import logging
from datetime import datetime, timedelta

import sentry_sdk
from django.db import router
from django.db.models import Q
from django.db.utils import IntegrityError
from django.utils import timezone

from sentry import options
from sentry.demo_mode.utils import get_demo_org, is_demo_mode_enabled
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
)
from sentry.models.debugfile import ProguardArtifactRelease, ProjectDebugFile
from sentry.models.files import FileBlobOwner
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import demomode_tasks
from sentry.utils.db import atomic_transaction

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.demo_mode.tasks.sync_debug_artifacts",
    queue="demo_mode",
    taskworker_config=TaskworkerConfig(namespace=demomode_tasks),
)
def sync_debug_artifacts():

    if (
        not options.get("sentry.demo_mode.sync_debug_artifacts.enable")
        or not is_demo_mode_enabled()
    ):
        return

    source_org_id = options.get("sentry.demo_mode.sync_debug_artifacts.source_org_id")
    source_org = Organization.objects.get(id=source_org_id)

    target_org = get_demo_org()

    lookback_days = 3
    cutoff_date = timezone.now() - timedelta(days=lookback_days)

    _sync_artifact_bundles(source_org, target_org, cutoff_date)
    _sync_project_debug_files(source_org, target_org, cutoff_date)
    _sync_proguard_artifact_releases(source_org, target_org, cutoff_date)


def _sync_artifact_bundles(
    source_org: Organization, target_org: Organization, cutoff_date: datetime
):
    if not source_org or not target_org:
        return

    artifact_bundles = ArtifactBundle.objects.filter(
        Q(organization_id=source_org.id) | Q(organization_id=target_org.id),
        date_uploaded__gte=cutoff_date,
    )

    source_artifact_bundles = artifact_bundles.filter(organization_id=source_org.id)
    target_artifact_bundles = artifact_bundles.filter(organization_id=target_org.id)

    different_artifact_bundles = source_artifact_bundles.exclude(
        bundle_id__in=target_artifact_bundles.values_list("bundle_id", flat=True)
    )

    for source_artifact_bundle in different_artifact_bundles:
        _sync_artifact_bundle(source_artifact_bundle, target_org)


def _sync_project_debug_files(
    source_org: Organization, target_org: Organization, cutoff_date: datetime
):
    if not source_org or not target_org:
        return

    with sentry_sdk.start_span(name="sync-project-debug-files-get-project-ids") as span:
        source_project_ids = list(
            Project.objects.filter(
                organization_id=source_org.id,
            ).values_list("id", flat=True)
        )

        target_project_ids = list(
            Project.objects.filter(
                organization_id=target_org.id,
            ).values_list("id", flat=True)
        )
        span.set_attribute("source_project_ids", source_project_ids)
        span.set_attribute("target_project_ids", target_project_ids)

    project_debug_files = ProjectDebugFile.objects.filter(
        Q(project_id__in=source_project_ids) | Q(project_id__in=target_project_ids),
        date_accessed__gte=cutoff_date,
    )

    source_project_debug_files = project_debug_files.filter(
        project_id__in=source_project_ids,
    )

    target_project_debug_files = project_debug_files.filter(
        project_id__in=target_project_ids,
    )

    different_project_debug_files = source_project_debug_files.exclude(
        debug_id__in=target_project_debug_files.values_list("debug_id", flat=True)
    )

    for source_project_debug_file in different_project_debug_files:
        with sentry_sdk.start_span(name="sync-project-debug-files-sync-project-debug-file") as span:
            span.set_attribute("source_project_debug_file_id", source_project_debug_file.id)
            _sync_project_debug_file(source_project_debug_file, target_org)


def _sync_proguard_artifact_releases(
    source_org: Organization, target_org: Organization, cutoff_date: datetime
):
    if not source_org or not target_org:
        return

    proguard_artifact_releases = ProguardArtifactRelease.objects.filter(
        Q(organization_id=source_org.id) | Q(organization_id=target_org.id),
        date_added__gte=cutoff_date,
    )

    source_proguard_artifact_releases = proguard_artifact_releases.filter(
        organization_id=source_org.id,
    )
    target_proguard_artifact_releases = proguard_artifact_releases.filter(
        organization_id=target_org.id,
    )

    different_proguard_artifact_releases = source_proguard_artifact_releases.exclude(
        proguard_uuid__in=target_proguard_artifact_releases.values_list("proguard_uuid", flat=True)
    )

    for source_proguard_artifact_release in different_proguard_artifact_releases:
        _sync_proguard_artifact_release(source_proguard_artifact_release, target_org)


def _sync_artifact_bundle(source_artifact_bundle: ArtifactBundle, target_org: Organization):
    try:
        with atomic_transaction(
            using=(
                router.db_for_write(ArtifactBundle),
                router.db_for_write(FileBlobOwner),
                router.db_for_write(ProjectArtifactBundle),
                router.db_for_write(ReleaseArtifactBundle),
            )
        ):
            blobs = source_artifact_bundle.file.blobs.all()
            for blob in blobs:
                FileBlobOwner.objects.get_or_create(
                    organization_id=target_org.id,
                    blob_id=blob.id,
                )

            target_artifact_bundle = ArtifactBundle.objects.create(
                organization_id=target_org.id,
                bundle_id=source_artifact_bundle.bundle_id,
                artifact_count=source_artifact_bundle.artifact_count,
                date_last_modified=source_artifact_bundle.date_last_modified,
                date_uploaded=source_artifact_bundle.date_uploaded,
                file=source_artifact_bundle.file,
                indexing_state=source_artifact_bundle.indexing_state,
            )

            _sync_project_artifact_bundle(source_artifact_bundle, target_artifact_bundle)
            _sync_release_artifact_bundle(source_artifact_bundle, target_artifact_bundle)
    except IntegrityError as e:
        sentry_sdk.capture_exception(e)


def _sync_project_artifact_bundle(
    source_artifact_bundle: ArtifactBundle,
    target_artifact_bundle: ArtifactBundle,
):
    source_project_artifact_bundle = ProjectArtifactBundle.objects.filter(
        artifact_bundle_id=source_artifact_bundle.id,
        organization_id=source_artifact_bundle.organization_id,
    ).first()

    if not source_project_artifact_bundle:
        return

    target_project = _find_matching_project(
        source_project_artifact_bundle.project_id,
        target_artifact_bundle.organization_id,
    )

    if not target_project:
        return

    ProjectArtifactBundle.objects.create(
        project_id=target_project.id,
        artifact_bundle_id=target_artifact_bundle.id,
        organization_id=target_artifact_bundle.organization_id,
    )


def _sync_release_artifact_bundle(
    source_artifact_bundle: ArtifactBundle,
    target_artifact_bundle: ArtifactBundle,
):
    source_release_artifact_bundle = ReleaseArtifactBundle.objects.filter(
        artifact_bundle_id=source_artifact_bundle.id,
        organization_id=source_artifact_bundle.organization_id,
    ).first()

    if not source_release_artifact_bundle:
        return

    ReleaseArtifactBundle.objects.create(
        artifact_bundle_id=target_artifact_bundle.id,
        organization_id=target_artifact_bundle.organization_id,
        dist_name=source_release_artifact_bundle.dist_name,
        release_name=source_release_artifact_bundle.release_name,
    )


def _sync_project_debug_file(
    source_project_debug_file: ProjectDebugFile, target_org: Organization
) -> ProjectDebugFile | None:
    try:
        with atomic_transaction(using=(router.db_for_write(ProjectDebugFile))):
            target_project = _find_matching_project(
                source_project_debug_file.project_id,
                target_org.id,
            )

            if not target_project:
                return None

            return ProjectDebugFile.objects.create(
                project_id=target_project.id,
                file=source_project_debug_file.file,
                checksum=source_project_debug_file.checksum,
                object_name=source_project_debug_file.object_name,
                cpu_name=source_project_debug_file.cpu_name,
                debug_id=source_project_debug_file.debug_id,
                code_id=source_project_debug_file.code_id,
                data=source_project_debug_file.data,
                date_accessed=source_project_debug_file.date_accessed,
            )
    except IntegrityError as e:
        sentry_sdk.capture_exception(e)
        return None


def _sync_proguard_artifact_release(
    source_proguard_artifact_release: ProguardArtifactRelease, target_org: Organization
):
    try:
        with atomic_transaction(using=(router.db_for_write(ProguardArtifactRelease))):
            target_project = _find_matching_project(
                source_proguard_artifact_release.project_id,
                target_org.id,
            )

            if not target_project:
                return

            # project_debug_file _should_ already be synced, but we'll make sure it is
            project_debug_file = ProjectDebugFile.objects.filter(
                project_id=target_project.id,
                debug_id=source_proguard_artifact_release.project_debug_file.debug_id,
            ).first()

            if not project_debug_file:
                project_debug_file = _sync_project_debug_file(
                    source_proguard_artifact_release.project_debug_file, target_org
                )

            if not project_debug_file:
                # we require a project debug file
                return

            ProguardArtifactRelease.objects.create(
                organization_id=target_org.id,
                project_id=target_project.id,
                release_name=source_proguard_artifact_release.release_name,
                proguard_uuid=source_proguard_artifact_release.proguard_uuid,
                project_debug_file=project_debug_file,
                date_added=source_proguard_artifact_release.date_added,
            )
    except IntegrityError as e:
        sentry_sdk.capture_exception(e)


def _find_matching_project(project_id, organization_id):
    try:
        source_project = Project.objects.get(id=project_id)

        return Project.objects.get(
            organization_id=organization_id,
            slug=source_project.slug,
        )
    except Project.DoesNotExist:
        sentry_sdk.set_context("project_id", project_id)
        sentry_sdk.set_context("organization_id", organization_id)
        return None

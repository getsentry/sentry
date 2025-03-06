from datetime import timedelta

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
from sentry.models.files import FileBlobOwner
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.utils.db import atomic_transaction


@instrumented_task(
    name="sentry.demo_mode.tasks.sync_artifact_bundles",
    queue="demo_mode",
)
def sync_artifact_bundles():

    if (
        not options.get("sentry.demo_mode.sync_artifact_bundles.enable")
        or not is_demo_mode_enabled()
    ):
        return

    source_org_id = options.get("sentry.demo_mode.sync_artifact_bundles.source_org_id")
    source_org = Organization.objects.get(id=source_org_id)

    target_org = get_demo_org()

    lookback_days = options.get("sentry.demo_mode.sync_artifact_bundles.lookback_days")

    _sync_artifact_bundles(source_org, target_org, lookback_days)


def _sync_artifact_bundles(source_org: Organization, target_org: Organization, lookback_days=1):
    if not source_org or not target_org:
        return

    cutoff_date = timezone.now() - timedelta(days=lookback_days)

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
    source_project_artifact_bundle = ProjectArtifactBundle.objects.get(
        artifact_bundle_id=source_artifact_bundle.id,
        organization_id=source_artifact_bundle.organization_id,
    )

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


def _find_matching_project(project_id, organization_id):
    source_project = Project.objects.get(id=project_id)

    return Project.objects.get(
        organization_id=organization_id,
        slug=source_project.slug,
    )

from __future__ import annotations

import logging
import secrets
from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone

from sentry.preprod.models import InstallablePreprodArtifact, PreprodArtifact
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


def is_installable_artifact(artifact: PreprodArtifact) -> bool:
    # TODO: Adjust this logic when we have a better way to determine if an artifact is installable
    return artifact.installable_app_file_id is not None and artifact.build_number is not None


def get_download_count_for_artifact(artifact: PreprodArtifact) -> int:
    download_count = getattr(artifact, "download_count", None)
    if download_count is None:
        download_count = (
            InstallablePreprodArtifact.objects.filter(preprod_artifact=artifact).aggregate(
                total_downloads=Sum("download_count")
            )["total_downloads"]
            or 0
        )
    return int(download_count)


def get_download_url_for_artifact(artifact: PreprodArtifact) -> str:
    """
    Generate a download URL for a PreprodArtifact.

    Args:
        artifact: The PreprodArtifact to generate a download URL for
        request: The HTTP request object to build absolute URLs

    Returns:
        A download URL string for the artifact
    """
    # Create an installable artifact (this handles the URL path generation and expiration)
    installable = create_installable_preprod_artifact(artifact)

    # iOS apps (XCARCHIVE type) have a indirection via plist.
    # Android apps (no matter the original format) will be an APK.
    url_params = ""
    match artifact.artifact_type:
        case PreprodArtifact.ArtifactType.XCARCHIVE:
            url_params = "?response_format=plist"
        case PreprodArtifact.ArtifactType.AAB:
            url_params = "?response_format=apk"
        case PreprodArtifact.ArtifactType.APK:
            url_params = "?response_format=apk"
        case _:
            url_params = ""

    download_url = absolute_uri(
        f"/api/0/projects/{artifact.project.organization.slug}/{artifact.project.slug}/files/installablepreprodartifact/{installable.url_path}/{url_params}"
    )

    return download_url


def create_installable_preprod_artifact(
    preprod_artifact: PreprodArtifact, expiration_hours: int = 12
) -> InstallablePreprodArtifact:
    """
    Creates a new InstallablePreprodArtifact for a given PreprodArtifact.

    Args:
        preprod_artifact: The PreprodArtifact to create an installable version for
        expiration_hours: Number of hours until the install link expires (default: 12)

    Returns:
        The created InstallablePreprodArtifact instance
    """

    url_path = secrets.token_urlsafe(12)

    # Set expiration date
    expiration_date = timezone.now() + timedelta(hours=expiration_hours)

    # Create the installable artifact
    installable_artifact = InstallablePreprodArtifact.objects.create(
        preprod_artifact=preprod_artifact,
        url_path=url_path,
        expiration_date=expiration_date,
        download_count=0,
    )

    logger.info(
        "Created installable preprod artifact",
        extra={
            "installable_artifact_id": installable_artifact.id,
            "preprod_artifact_id": preprod_artifact.id,
            "project_id": preprod_artifact.project.id,
            "organization_id": preprod_artifact.project.organization.id,
            "expiration_date": expiration_date.isoformat(),
        },
    )

    return installable_artifact

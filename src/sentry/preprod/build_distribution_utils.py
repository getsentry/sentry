from __future__ import annotations

import logging
import secrets
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.db.models import Q, Sum
from django.utils import timezone
from packaging.version import parse as parse_version

from sentry.models.project import Project
from sentry.preprod.models import InstallablePreprodArtifact, PreprodArtifact
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ArtifactInstallInfo:
    """Computed install state for a PreprodArtifact.

    WARNING: This is used by PUBLIC API endpoints. Changes to this dataclass
    or to get_artifact_install_info() may break the public API contract.
    Always verify public endpoint tests pass after modifying.
    """

    is_installable: bool
    install_url: str | None
    download_count: int
    release_notes: str | None
    install_groups: list[str] | None
    is_code_signature_valid: bool | None
    profile_name: str | None
    codesigning_type: str | None


def get_artifact_install_info(artifact: PreprodArtifact) -> ArtifactInstallInfo:
    """Compute install state for an artifact.

    WARNING: This is used by PUBLIC API endpoints. Changes here may break the
    public API contract. Always verify public endpoint tests pass after modifying.
    """
    extras = artifact.extras or {}
    installable = is_installable_artifact(artifact)
    install_url: str | None = None

    if installable:
        install_url = get_download_url_for_artifact(artifact)

    download_count = get_download_count_for_artifact(artifact) if installable else 0
    release_notes = extras.get("release_notes")
    install_groups = extras.get("install_groups")

    is_code_signature_valid: bool | None = None
    profile_name: str | None = None
    codesigning_type: str | None = None

    if artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
        is_code_signature_valid = extras.get("is_code_signature_valid") is True
        profile_name = extras.get("profile_name")
        codesigning_type = extras.get("codesigning_type")

    return ArtifactInstallInfo(
        is_installable=installable,
        install_url=install_url,
        download_count=download_count,
        release_notes=release_notes,
        install_groups=install_groups,
        is_code_signature_valid=is_code_signature_valid,
        profile_name=profile_name,
        codesigning_type=codesigning_type,
    )


def is_installable_artifact(artifact: PreprodArtifact) -> bool:
    mobile_app_info = artifact.get_mobile_app_info()
    build_number = mobile_app_info.build_number if mobile_app_info else None
    if artifact.installable_app_file_id is None or build_number is None:
        return False
    if artifact.artifact_type == PreprodArtifact.ArtifactType.XCARCHIVE:
        extras = artifact.extras or {}
        if extras.get("is_code_signature_valid") is not True:
            return False
        if extras.get("codesigning_type") == "app-store":
            return False
    return True


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


def get_platform_artifact_type_filter(platform: str) -> dict[str, Any]:
    """Map platform string to artifact_type query filter kwargs."""
    if platform == "apple":
        return {"artifact_type": PreprodArtifact.ArtifactType.XCARCHIVE}
    elif platform == "android":
        return {
            "artifact_type__in": [
                PreprodArtifact.ArtifactType.AAB,
                PreprodArtifact.ArtifactType.APK,
            ]
        }
    return {}


def build_install_groups_q(groups: Sequence[str]) -> Q | None:
    """Build OR query for install_groups contains filtering."""
    if not groups:
        return None
    q = Q()
    for group in groups:
        q |= Q(extras__install_groups__contains=[group])
    return q


def find_current_artifact(
    project: Project,
    app_id: str,
    platform: str,
    build_version: str,
    build_number: int | None = None,
    main_binary_identifier: str | None = None,
    build_configuration: str | None = None,
    codesigning_type: str | None = None,
) -> PreprodArtifact | None:
    """Find the current artifact matching the provided build identifiers."""
    filter_kwargs: dict[str, Any] = {
        "project": project,
        "app_id": app_id,
        "state": PreprodArtifact.ArtifactState.PROCESSED,
        "mobile_app_info__build_version": build_version,
    }
    filter_kwargs.update(get_platform_artifact_type_filter(platform))

    if main_binary_identifier:
        filter_kwargs["main_binary_identifier"] = main_binary_identifier

    if build_number is not None:
        filter_kwargs["mobile_app_info__build_number"] = build_number

    if build_configuration:
        filter_kwargs["build_configuration__name"] = build_configuration

    if codesigning_type:
        filter_kwargs["extras__codesigning_type"] = codesigning_type

    try:
        return (
            PreprodArtifact.objects.select_related(
                "project__organization",
                "build_configuration",
                "commit_comparison",
                "mobile_app_info",
            )
            .filter(**filter_kwargs)
            .latest("date_added")
        )
    except PreprodArtifact.DoesNotExist:
        return None


def find_latest_installable_artifact(
    project: Project,
    app_id: str,
    platform: str,
    build_configuration_name: str | None = None,
    codesigning_type: str | None = None,
    install_groups: Sequence[str] | None = None,
) -> PreprodArtifact | None:
    """Find the latest installable artifact using semver comparison with build number tiebreaker."""
    filter_kwargs: dict[str, Any] = {
        "project": project,
        "app_id": app_id,
        "state": PreprodArtifact.ArtifactState.PROCESSED,
        "installable_app_file_id__isnull": False,
        "mobile_app_info__build_number__isnull": False,
    }
    filter_kwargs.update(get_platform_artifact_type_filter(platform))

    if platform == "apple":
        filter_kwargs["extras__is_code_signature_valid"] = True

    if build_configuration_name:
        filter_kwargs["build_configuration__name"] = build_configuration_name

    if codesigning_type:
        filter_kwargs["extras__codesigning_type"] = codesigning_type

    install_groups_q = build_install_groups_q(install_groups) if install_groups else None

    # Get all distinct versions from installable artifacts only
    versions_queryset = PreprodArtifact.objects.filter(**filter_kwargs)
    if install_groups_q:
        versions_queryset = versions_queryset.filter(install_groups_q)

    all_versions = versions_queryset.values_list(
        "mobile_app_info__build_version", flat=True
    ).distinct()

    # Find the highest semver version
    highest_version: str | None = None
    for version in all_versions:
        if version:
            try:
                parsed_version = parse_version(version)
                if highest_version is None or parsed_version > parse_version(highest_version):
                    highest_version = version
            except Exception:
                continue

    if not highest_version:
        return None

    # Get the installable artifact with the highest build number for this version
    filter_kwargs["mobile_app_info__build_version"] = highest_version
    potential_artifacts_qs = (
        PreprodArtifact.objects.select_related(
            "project__organization",
            "build_configuration",
            "commit_comparison",
            "mobile_app_info",
        )
        .filter(**filter_kwargs)
        .order_by("-mobile_app_info__build_number", "-date_added")
    )
    if install_groups_q:
        potential_artifacts_qs = potential_artifacts_qs.filter(install_groups_q)

    return potential_artifacts_qs.first()


def find_current_and_latest(
    project: Project,
    app_id: str,
    platform: str,
    build_version: str | None = None,
    build_number: int | None = None,
    main_binary_identifier: str | None = None,
    build_configuration: str | None = None,
    codesigning_type: str | None = None,
    install_groups: Sequence[str] | None = None,
) -> tuple[PreprodArtifact | None, PreprodArtifact | None]:
    """Find the current artifact and the latest installable artifact.

    When build_version is provided, looks up the current artifact first and
    inherits its build_configuration, codesigning_type, and install_groups
    for the latest lookup when those aren't explicitly provided.

    Returns (current_artifact, latest_artifact).
    """
    current_artifact = None

    effective_build_configuration = build_configuration
    effective_codesigning_type = codesigning_type
    effective_install_groups = install_groups

    if build_version:
        current_artifact = find_current_artifact(
            project=project,
            app_id=app_id,
            platform=platform,
            build_version=build_version,
            build_number=build_number,
            main_binary_identifier=main_binary_identifier,
            build_configuration=build_configuration,
            codesigning_type=codesigning_type,
        )

        if current_artifact:
            if not effective_build_configuration and current_artifact.build_configuration:
                effective_build_configuration = current_artifact.build_configuration.name

            if not effective_codesigning_type and current_artifact.extras:
                effective_codesigning_type = current_artifact.extras.get("codesigning_type")

            if not effective_install_groups and current_artifact.extras:
                current_groups = current_artifact.extras.get("install_groups")
                if current_groups and isinstance(current_groups, list):
                    effective_install_groups = current_groups

    latest_artifact = find_latest_installable_artifact(
        project=project,
        app_id=app_id,
        platform=platform,
        build_configuration_name=effective_build_configuration,
        codesigning_type=effective_codesigning_type,
        install_groups=effective_install_groups,
    )

    return current_artifact, latest_artifact

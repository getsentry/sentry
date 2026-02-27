from __future__ import annotations

from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.url_utils import get_preprod_artifact_url

COMMENT_ANCHOR = "<!-- sentry-build-distribution -->"


def format_pr_comment(artifacts: list[PreprodArtifact]) -> str:
    installable = [a for a in artifacts if is_installable_artifact(a)]
    if not installable:
        raise ValueError("No installable artifacts to format")

    android_rows: list[str] = []
    ios_rows: list[str] = []

    for artifact in installable:
        mobile_app_info = getattr(artifact, "mobile_app_info", None)
        app_name = mobile_app_info.app_name if mobile_app_info else None
        app_id = artifact.app_id or "Unknown"
        version_string = _format_version_string(artifact)
        config = artifact.build_configuration.name if artifact.build_configuration else "--"
        artifact_url = get_preprod_artifact_url(artifact, view_type="install")

        name_cell = f"[{app_name or app_id}]({artifact_url})"

        row = f"| {name_cell} | {version_string} | {config} |"

        if artifact.is_android():
            android_rows.append(row)
        else:
            ios_rows.append(row)

    sections: list[str] = [COMMENT_ANCHOR, "## Sentry Build Distribution"]

    header = "| App | Version | Configuration |"
    separator = "|-----|---------|---------------|"

    if ios_rows:
        if android_rows:
            sections.append(f"### iOS\n\n{header}\n{separator}\n" + "\n".join(ios_rows))
        else:
            sections.append(f"{header}\n{separator}\n" + "\n".join(ios_rows))

    if android_rows:
        if ios_rows:
            sections.append(f"### Android\n\n{header}\n{separator}\n" + "\n".join(android_rows))
        else:
            sections.append(f"{header}\n{separator}\n" + "\n".join(android_rows))

    return "\n\n".join(sections)


def _format_version_string(artifact: PreprodArtifact) -> str:
    mobile_app_info = getattr(artifact, "mobile_app_info", None)
    build_version = mobile_app_info.build_version if mobile_app_info else None
    build_number = mobile_app_info.build_number if mobile_app_info else None
    parts = []
    if build_version:
        parts.append(build_version)
    if build_number:
        parts.append(f"({build_number})")
    return " ".join(parts) if parts else "--"

from __future__ import annotations

from sentry.preprod.models import PreprodArtifact
from sentry.preprod.url_utils import get_preprod_artifact_url


def format_pr_comment(artifacts: list[PreprodArtifact]) -> str:
    if not artifacts:
        raise ValueError("No installable artifacts to format")

    android_rows: list[str] = []
    ios_rows: list[str] = []

    for artifact in artifacts:
        mobile_app_info = artifact.get_mobile_app_info()
        app_name = mobile_app_info.app_name if mobile_app_info else None
        app_id = artifact.app_id or "Unknown"
        version_string = mobile_app_info.format_version_string() if mobile_app_info else "--"
        config = artifact.build_configuration.name if artifact.build_configuration else "--"
        artifact_url = get_preprod_artifact_url(artifact, view_type="install")

        name_cell = f"[{app_name or app_id}]({artifact_url})"

        row = f"| {name_cell} | {version_string} | {config} |"

        if artifact.is_android():
            android_rows.append(row)
        else:
            ios_rows.append(row)

    sections: list[str] = ["## Sentry Build Distribution"]

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

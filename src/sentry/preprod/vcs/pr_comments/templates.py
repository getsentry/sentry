from __future__ import annotations

from sentry.models.project import Project
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.url_utils import get_preprod_artifact_url


def format_pr_comment(artifacts: list[PreprodArtifact], project: Project) -> str:
    if not artifacts:
        raise ValueError("No installable artifacts to format")

    android_rows: list[str] = []
    ios_rows: list[str] = []

    for artifact in artifacts:
        mobile_app_info = artifact.get_mobile_app_info()
        app_name_value = mobile_app_info.app_name if mobile_app_info else None
        app_name = app_name_value or "--"
        app_id = artifact.app_id or "--"
        version_string = mobile_app_info.format_version_string() if mobile_app_info else "--"
        config = artifact.build_configuration.name if artifact.build_configuration else "--"
        artifact_url = get_preprod_artifact_url(artifact, view_type="install")

        install_cell = f"[Install Build]({artifact_url})"

        row = f"| {app_name} | {app_id} | {version_string} | {config} | {install_cell} |"

        if artifact.is_android():
            android_rows.append(row)
        else:
            ios_rows.append(row)

    sections: list[str] = ["## Sentry Build Distribution"]

    header = "| App Name | App ID | Version | Configuration | Install Page |"
    separator = "|----------|--------|---------|---------------|--------------|"

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

    settings_url = project.organization.absolute_url(
        f"/settings/projects/{project.slug}/mobile-builds/", query="tab=distribution"
    )
    sections.append(f"[Configure {project.name} build distribution settings]({settings_url})")

    return "\n\n".join(sections)

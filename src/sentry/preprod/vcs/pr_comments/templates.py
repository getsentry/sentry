from __future__ import annotations

from sentry.models.project import Project
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.url_utils import get_preprod_artifact_url
from sentry.preprod.vcs.markdown_utils import escape_markdown


def format_pr_comment(artifacts: list[PreprodArtifact], project: Project) -> str:
    if not artifacts:
        raise ValueError("No installable artifacts to format")

    android_rows: list[str] = []
    ios_rows: list[str] = []

    for artifact in artifacts:
        # Artifact-derived fields are untrusted and escaped for Markdown.
        mobile_app_info = artifact.get_mobile_app_info()
        app_name_value = mobile_app_info.app_name if mobile_app_info else None
        app_name = escape_markdown(app_name_value, default="--")
        app_id = escape_markdown(artifact.app_id, default="--")
        version_string = escape_markdown(
            mobile_app_info.format_version_string() if mobile_app_info else "--"
        )
        config_value = artifact.build_configuration.name if artifact.build_configuration else None
        config = escape_markdown(config_value, default="--")
        artifact_url = get_preprod_artifact_url(artifact, view_type="install")

        app_name_cell = f"[{app_name}]({artifact_url})"

        row = f"| {app_name_cell} | {app_id} | {version_string} | {config} |"

        if artifact.is_android():
            android_rows.append(row)
        else:
            ios_rows.append(row)

    sections: list[str] = ["## 📲 Install Builds"]

    header = "| 🔗 App Name | App ID | Version | Configuration |"
    separator = "|-------------|--------|---------|---------------|"

    if ios_rows:
        sections.append(f"### iOS\n\n{header}\n{separator}\n" + "\n".join(ios_rows))

    if android_rows:
        sections.append(f"### Android\n\n{header}\n{separator}\n" + "\n".join(android_rows))

    settings_url = project.organization.absolute_url(
        f"/settings/projects/{project.slug}/mobile-builds/", query="tab=distribution"
    )
    sections.append(f"[⚙️ {project.name} Build Distribution Settings]({settings_url})")

    return "\n\n".join(sections)

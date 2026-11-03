"""Resolve the shader binaries teapot reports missing to presigned URLs.

``missing_difs`` names them by kind ``dxil`` and the 16-hex Aftermath shader hash
stored as ``code_id``.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import timedelta
from typing import Any

from sentry.debug_files.debug_files import maybe_renew_debug_files
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.project import Project
from sentry.objectstore import get_internal_download_url
from sentry.utils import metrics

SHADER_DIF_URL_VALIDITY = timedelta(minutes=15)


def missing_shader_difs(response: Mapping[str, Any]) -> list[str]:
    """The dxil code ids in teapot's ``missing_difs``."""
    code_ids: list[str] = []
    for entry in response.get("missing_difs") or []:
        if not isinstance(entry, dict) or entry.get("kind") != "dxil":
            continue
        debug_id = entry.get("debug_id")
        if isinstance(debug_id, str) and debug_id:
            code_ids.append(debug_id)
    return code_ids


def _find_dxil(project_id: int, code_id: str) -> ProjectDebugFile | None:
    """The newest objectstore-backed dxil debug file with ``code_id``."""
    difs = ProjectDebugFile.objects.filter(
        project_id=project_id, code_id=code_id, storage_path__isnull=False
    ).order_by("-id")
    return next((dif for dif in difs if dif.file_format == "dxil"), None)


def resolve_shader_difs(project: Project, response: Mapping[str, Any]) -> list[dict[str, str]]:
    """Entries for teapot's ``shader_binaries`` request array: every shader binary it
    reported missing that we hold, with a presigned URL."""
    code_ids = missing_shader_difs(response)
    resolved: list[dict[str, str]] = []
    found: list[ProjectDebugFile] = []

    for code_id in dict.fromkeys(code_id.lower() for code_id in code_ids):
        dxil = _find_dxil(project.id, code_id)
        if dxil is None or not dxil.storage_path:
            continue
        found.append(dxil)
        url = get_internal_download_url(
            dxil.get_objectstore_session(),
            dxil.storage_path,
            token_validity=SHADER_DIF_URL_VALIDITY,
        )
        entry = {"code_id": code_id, "storage_url": url}
        if group := (dxil.data or {}).get("shader_group"):
            entry["group"] = group
        resolved.append(entry)

    if code_ids:
        metrics.incr("tasks.gpu_crash.shader_difs.missing", amount=len(code_ids))
    if found:
        maybe_renew_debug_files(found)
        metrics.incr("tasks.gpu_crash.shader_difs.resolved", amount=len(found))
    return resolved

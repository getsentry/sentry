#!/usr/bin/env python3
import hashlib
import json
import os
import sys
import urllib.request
from pathlib import Path

SENTRY_URL = "https://sentry.io"


def api_request(
    method: str,
    url: str,
    auth_token: str,
    body: bytes | None = None,
    content_type: str = "application/json",
) -> dict | None:
    headers = {"Authorization": f"Bearer {auth_token}"}
    if body is not None:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    with urllib.request.urlopen(req) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else None


def upload_images(
    snapshot_dir: Path,
    auth_token: str,
    org_slug: str,
    org_id: str,
    project_id: str,
) -> dict:
    images = {}

    for json_path in sorted(snapshot_dir.rglob("*.json")):
        png_path = json_path.with_suffix(".png")
        if not png_path.exists():
            continue

        meta = json.loads(json_path.read_text())
        data = png_path.read_bytes()
        sha = hashlib.sha256(data).hexdigest()
        rel = str(png_path.relative_to(snapshot_dir))
        obj_key = (
            f"v1/objects/preprod/org={org_id};project={project_id}/{org_id}/{project_id}/{sha}"
        )

        print(f"  {rel} ({meta['width']}x{meta['height']})", flush=True)

        api_request(
            "PUT",
            f"{SENTRY_URL}/api/0/organizations/{org_slug}/objectstore/{obj_key}",
            auth_token,
            data,
            content_type="application/octet-stream",
        )

        images[sha] = {
            "display_name": meta.get("display_name"),
            "image_file_name": rel,
            "width": meta["width"],
            "height": meta["height"],
        }

    return images


def main() -> int:
    auth_token = os.environ["SENTRY_AUTH_TOKEN"]
    org_slug = os.environ["SENTRY_ORG"]
    project_slug = os.environ["SENTRY_PROJECT"]
    app_id = os.environ["APP_ID"]
    head_sha = os.environ["HEAD_SHA"]
    head_ref = os.environ["HEAD_REF"]
    head_repo = os.environ["HEAD_REPO"]
    base_sha = os.environ.get("BASE_SHA", "")
    base_ref = os.environ.get("BASE_REF", "")
    pr_number = os.environ.get("PR_NUMBER", "")
    snapshot_dir = Path(os.environ.get("SNAPSHOT_DIR", ".artifacts/visual-snapshots"))

    print("Resolving org and project IDs...")
    org = api_request("GET", f"{SENTRY_URL}/api/0/organizations/{org_slug}/", auth_token)
    org_id = org["id"]
    projects = api_request(
        "GET", f"{SENTRY_URL}/api/0/organizations/{org_slug}/projects/", auth_token
    )
    project_id = next(p["id"] for p in projects if p["slug"] == project_slug)
    print(f"Org={org_id} Project={project_id}")

    print(f"\nUploading images from {snapshot_dir}...")
    images = upload_images(snapshot_dir, auth_token, org_slug, org_id, project_id)
    print(f"Uploaded {len(images)} image(s)")

    vcs: dict = {
        "head_sha": head_sha,
        "provider": "github",
        "head_repo_name": head_repo,
        "head_ref": head_ref,
    }
    if pr_number:
        vcs.update(
            {
                "base_sha": base_sha,
                "base_repo_name": head_repo,
                "base_ref": base_ref,
                "pr_number": int(pr_number),
            }
        )

    print("\nCreating snapshot artifact...")
    body = json.dumps({"app_id": app_id, "images": images, **vcs}).encode()
    resp = api_request(
        "POST",
        f"{SENTRY_URL}/api/0/projects/{org_slug}/{project_slug}/preprodartifacts/snapshots/",
        auth_token,
        body,
    )

    artifact_id = resp["artifactId"]
    print(f"{SENTRY_URL}/organizations/{org_slug}/preprod/snapshots/{artifact_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

import os
import sys

import requests
from django.conf import settings
from google.auth import default

from sentry.utils import json


def in_test_environment() -> bool:
    return "pytest" in sys.argv[0] or "vscode" in sys.argv[0]


def gcp_project_id() -> str:
    if in_test_environment():
        return "__test_gcp_project__"

    # Try the metadata endpoint, if possible. If not, we'll assume a local environment as use the
    # app credentials env variable instead.
    try:
        return requests.get(
            "http://metadata.google.internal/computeMetadata/v1/project/project-id",
            headers={
                "Metadata-Flavor": "Google",
            },
        ).text
    except requests.exceptions.RequestException:
        adc_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        if adc_path:
            with open(adc_path) as fp:
                adc = json.load(fp)
                if adc.get("quota_project_id") is not None:
                    return adc.get("quota_project_id")

    return "__unknown_gcp_project__"


# TODO(getsentry/team-ospo#190): Remove once fully deployed.
def log_gcp_credentials_details(logger) -> None:
    if in_test_environment():
        return

    credentials, project_id = default()

    if not credentials:
        logger.error("gcp.credentials.notfound")
        return

    logger.info(
        "gcp.credentials.found",
        extra={
            "sanitized_credentials": {
                "client_id": getattr(credentials, "client_id", None),
                "expired": getattr(credentials, "expired", None),
                "expiry": getattr(credentials, "expiry", None),
                "granted_scopes": getattr(credentials, "granted_scopes", None),
                "quota_project_id": getattr(credentials, "quota_project_id", None),
                "scopes": getattr(credentials, "scopes", None),
                "valid": getattr(credentials, "valid", None),
            },
            "project_id": project_id,
        },
    )


def is_split_db() -> bool:
    if len(settings.DATABASES) != 1:  # type: ignore
        return True
    for db in settings.DATABASES.values():  # type: ignore
        if db["NAME"] in {"region", "control"}:
            return True
    return False

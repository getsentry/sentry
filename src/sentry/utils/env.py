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

    # Checking GOOGLE_APPLICATION_CREDENTIALS environment variable
    adc_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if adc_path:
        with open(adc_path) as fp:
            adc = json.load(fp)

            logger.info(
                "gcp.credentials.file_found",
                extra={
                    "adc": adc.get("quota_project_id", ""),
                    "adc_path": adc_path,
                    "adc_json": adc.keys(),
                },
            )

    # Checking User credentials set up by using the Google Cloud CLI
    cli_auth_path = "$HOME/.config/gcloud/application_default_credentials.json"
    expanded_cli_auth_path = os.path.expandvars(cli_auth_path)

    if os.path.exists(expanded_cli_auth_path):
        logger.info(
            "gcp.credentials.user_cli_found",
            extra={
                "user_cli": expanded_cli_auth_path,
            },
        )
    else:
        logger.info(
            "gcp.credentials.user_cli_not_found",
            extra={
                "user_cli": expanded_cli_auth_path,
            },
        )

    # Checking The attached service account, returned by the metadata server
    try:
        # this will only work inside a GCP machine
        service_accounts = requests.get(
            "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/",
            headers={
                "Metadata-Flavor": "Google",
            },
        ).text

        logger.info(
            "gcp.credentials.service_accounts",
            extra={
                "service_accounts": service_accounts,
            },
        )
    except requests.exceptions.RequestException:
        logger.info(
            "Unable to get service accounts from metadata server, this only works inside gke pod or gcp machine"
        )

    # Checking using google-auth
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
                "service_account_email": getattr(credentials, "service_account_email", None),
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

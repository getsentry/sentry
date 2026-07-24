from __future__ import annotations

import logging
import secrets

import google.auth
from google.auth.exceptions import DefaultCredentialsError
from google.auth.transport.requests import AuthorizedSession
from requests.exceptions import RequestException

from sentry.integrations.models.gcp_service_account import GcpServiceAccount
from sentry.shared_integrations.exceptions import IntegrationError

logger = logging.getLogger(__name__)

_GCP_IAM_BASE = "https://iam.googleapis.com/v1"
_IAM_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]
_CONNECTORS_PROJECT = "sentry-connectors"


def generate_sentry_sa(org_id: int) -> str:
    existing = GcpServiceAccount.objects.filter(organization_id=org_id).first()
    if existing:
        return existing.service_account_email

    try:
        session = _get_iam_session()
        sa_email = _create_service_account(session, org_id)

        GcpServiceAccount.objects.create(
            organization_id=org_id,
            service_account_email=sa_email,
        )

        logger.info(
            "gcp.sa_created",
            extra={
                "organization_id": org_id,
                "sa_email": sa_email,
            },
        )
    except IntegrationError:
        raise
    except RequestException:
        logger.exception(
            "gcp.sa_creation_network_error",
            extra={"organization_id": org_id},
        )
        raise IntegrationError(
            "Failed to connect to GCP IAM API. Please check network connectivity."
        )

    return sa_email


def delete_sentry_sa(sa_email: str, org_id: int) -> None:
    try:
        session = _get_iam_session()
        url = f"{_GCP_IAM_BASE}/projects/{_CONNECTORS_PROJECT}/serviceAccounts/{sa_email}"
        resp = session.delete(url)
        if resp.status_code == 404:
            logger.warning(
                "gcp.sa_delete_not_found",
                extra={"sa_email": sa_email},
            )
        elif not resp.ok:
            logger.error(
                "gcp.sa_delete_failed",
                extra={"sa_email": sa_email, "status_code": resp.status_code},
            )
    except (RequestException, IntegrationError):
        logger.exception(
            "gcp.sa_delete_error",
            extra={"sa_email": sa_email},
        )

    GcpServiceAccount.objects.filter(organization_id=org_id).delete()

    logger.info(
        "gcp.sa_deleted",
        extra={"sa_email": sa_email, "organization_id": org_id},
    )


def _get_iam_session() -> AuthorizedSession:
    try:
        credentials, _ = google.auth.default(scopes=_IAM_SCOPES)
    except DefaultCredentialsError:
        raise IntegrationError(
            "GCP credentials are not available. Ensure the application "
            "has valid GCP credentials configured."
        )
    return AuthorizedSession(credentials)


def _create_service_account(
    session: AuthorizedSession,
    org_id: int,
) -> str:
    account_id = f"sentry-{secrets.token_hex(6)}"
    url = f"{_GCP_IAM_BASE}/projects/{_CONNECTORS_PROJECT}/serviceAccounts"

    response = session.post(
        url,
        json={
            "accountId": account_id,
            "serviceAccount": {
                "displayName": f"Sentry org {org_id}",
            },
        },
    )
    if not response.ok:
        logger.error(
            "gcp.sa_create_failed",
            extra={
                "organization_id": org_id,
                "status_code": response.status_code,
            },
        )
        raise IntegrationError(
            "Failed to create GCP service account. Please try again or contact support."
        )

    sa_email: str = response.json()["email"]
    return sa_email

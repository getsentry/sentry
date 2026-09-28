from __future__ import annotations

import base64
import re

import google.auth
import requests
from django.conf import settings
from google.auth.exceptions import GoogleAuthError
from google.auth.transport.requests import AuthorizedSession, Request

from sentry import options
from sentry.seer.attachments.models import AttachmentError, observe

_RATINGS = {"VERY_UNLIKELY": 1, "UNLIKELY": 2, "POSSIBLE": 3, "LIKELY": 4, "VERY_LIKELY": 5}


def scan_image(data: bytes) -> None:
    with observe("scan"):
        project = settings.SEER_ATTACHMENTS_VISION_PROJECT
        location = settings.SEER_ATTACHMENTS_VISION_LOCATION
        if location not in ("us", "eu") or not re.fullmatch(r"[a-zA-Z0-9-]+", project):
            raise AttachmentError("scan_unavailable", "Image scanning is not configured.", 503)
        url = f"https://{location}-vision.googleapis.com/v1/projects/{project}/locations/{location}/images:annotate"
        body = {
            "requests": [
                {
                    "image": {"content": base64.b64encode(data).decode("ascii")},
                    "features": [{"type": "SAFE_SEARCH_DETECTION"}],
                }
            ]
        }
        timeout = float(options.get("seer.attachments.scan-timeout-seconds"))
        try:
            credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            # Supply the auth transport explicitly: AuthorizedSession otherwise
            # creates a credential-refresh session with three hidden retries.
            with (
                requests.Session() as auth_session,
                AuthorizedSession(
                    credentials,
                    auth_request=Request(session=auth_session),
                    refresh_timeout=timeout,
                    max_refresh_attempts=0,
                ) as session,
            ):
                for attempt in range(2):
                    try:
                        response = session.post(
                            url, json=body, timeout=timeout, allow_redirects=False
                        )
                        with response:
                            if response.status_code == 429 or response.status_code >= 500:
                                if attempt == 0:
                                    continue
                            if response.status_code != 200:
                                raise AttachmentError(
                                    "scan_unavailable",
                                    "Image scanning is temporarily unavailable.",
                                    503,
                                )
                            result = response.json()
                        break
                    except (requests.Timeout, requests.ConnectionError):
                        if attempt:
                            raise
        except (GoogleAuthError, requests.RequestException, ValueError) as exc:
            raise AttachmentError(
                "scan_unavailable", "Image scanning is temporarily unavailable.", 503
            ) from exc
        try:
            responses = result["responses"]
            if len(responses) != 1 or responses[0].get("error"):
                raise ValueError("Scan failed")
            annotation = responses[0]["safeSearchAnnotation"]
            ratings = {
                category: _RATINGS[annotation[category]]
                for category in ("adult", "violence", "racy")
            }
        except (KeyError, TypeError, ValueError, IndexError, AttributeError) as exc:
            raise AttachmentError(
                "scan_inconclusive", "Image scanning did not return a conclusive result.", 503
            ) from exc
        for category, rating in ratings.items():
            threshold = int(options.get(f"seer.attachments.scan-{category}-threshold"))
            if threshold not in _RATINGS.values():
                raise AttachmentError("scan_unavailable", "Image scanning is not configured.", 503)
            if rating >= threshold:
                raise AttachmentError("image_rejected", "The image did not pass the safety check.")

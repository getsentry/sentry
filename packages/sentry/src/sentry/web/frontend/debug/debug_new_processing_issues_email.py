from __future__ import annotations

from typing import Any, Mapping, Sequence

from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import Organization, Project
from sentry.notifications.types import GroupSubscriptionReason
from sentry.utils.http import absolute_uri

from .mail import MailPreview

UUIDS = {
    "a2df1794-e0c7-371c-baa4-93eac340a78a": "native_missing_dsym",
    "12dc1b4c-a01b-463f-ae88-5cf0c31ae680": "native_bad_dsym",
}


def get_issues_data(uuids: Sequence[str] | None = None) -> Sequence[Mapping[str, Any]]:
    """Generate mock issues data."""
    return [
        {
            "data": {
                "image_arch": "arm64",
                "image_path": "/var/containers/Bundle/Application/FB14D416-DE4E-4224-9789-6B88E9C42601/CrashProbeiOS.app/CrashProbeiOS",
                "image_uuid": uuid,
            },
            "object": f"dsym:{uuid}",
            "scope": "native",
            "type": type,
        }
        for uuid, type in (uuids or UUIDS).items()
    ]


class DebugNewProcessingIssuesEmailView(View):
    reprocessing_active = True

    def get(self, request: Request) -> Response:
        from sentry.notifications.utils import summarize_issues

        org = Organization(id=1, slug="organization", name="My Company")
        project = Project(id=1, organization=org, slug="project", name="My Project")
        return MailPreview(
            html_template="sentry/emails/activity/new_processing_issues.html",
            text_template="sentry/emails/activity/new_processing_issues.txt",
            context={
                "project": project,
                "reason": GroupSubscriptionReason.descriptions[
                    GroupSubscriptionReason.processing_issue
                ],
                "issues": summarize_issues(get_issues_data()),
                "reprocessing_active": self.reprocessing_active,
                "info_url": absolute_uri(
                    f"/settings/{org.slug}/projects/{project.slug}/processing-issues/"
                ),
            },
        ).render(request)


class DebugNewProcessingIssuesNoReprocessingEmailView(DebugNewProcessingIssuesEmailView):
    reprocessing_active = False

import datetime
from urllib.parse import quote

import pytz
from rest_framework.request import Request
from sentry_relay import parse_release

from sentry.models import Deploy, Organization, Project, Release
from sentry.notifications.types import GroupSubscriptionReason
from sentry.utils.http import absolute_uri

from .mail import MailPreviewView


class DebugReleaseSummaryEmailView(MailPreviewView):
    @property
    def text_template(self):
        return "sentry/emails/activity/release_summary.txt"

    @property
    def html_template(self):
        return "sentry/emails/activity/release_summary.html"

    def get_context(self, request: Request):
        org = Organization(id=1, slug="organization", name="My Company")
        projects = [
            Project(id=1, organization=org, slug="project", name="My Project"),
            Project(id=2, organization=org, slug="another-project", name="Another Project"),
            Project(id=3, organization=org, slug="yet-another-project", name="Yet Another Project"),
        ]
        version = "6c998f755f304593a4713abd123eaf8833a2de5e"
        version_parsed = parse_release(version)["description"]
        release = Release(
            organization_id=org.id,
            version=version,
            date_added=datetime.datetime(2016, 10, 12, 15, 39, tzinfo=pytz.utc),
        )

        deploy = Deploy(
            release=release,
            organization_id=org.id,
            environment_id=1,
            date_finished=datetime.datetime(2016, 10, 12, 15, 39, tzinfo=pytz.utc),
        )

        release_links = [
            absolute_uri(f"/organizations/{org.slug}/releases/{release.version}/?project={p.id}")
            for p in projects
        ]

        issue_links = [
            absolute_uri(
                f"/organizations/{org.slug}/issues/?project={p.id}&query={quote(f'firstRelease:{release.version}')}"
            )
            for p in projects
        ]

        return {
            "author_count": 1,
            "commit_count": 4,
            "deploy": deploy,
            "environment": "production",
            "file_count": 5,
            "project_count": len(projects),
            "projects": list(zip(projects, release_links, issue_links, [6, 1, 0])),
            "reason": GroupSubscriptionReason.descriptions[GroupSubscriptionReason.committed],
            "release": release,
            "version_parsed": version_parsed,
        }

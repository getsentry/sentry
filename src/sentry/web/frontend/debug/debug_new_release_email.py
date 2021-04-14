import datetime

import pytz
from django.views.generic import View

from sentry.models import Commit, CommitAuthor, Deploy, Organization, Project, Release, User
from sentry.notifications.types import GroupSubscriptionReason
from sentry.utils.compat import zip
from sentry.utils.http import absolute_uri

from .mail import MailPreview


class DebugNewReleaseEmailView(View):
    def get(self, request):
        org = Organization(id=1, slug="organization", name="My Company")
        projects = [
            Project(id=1, organization=org, slug="project", name="My Project"),
            Project(id=2, organization=org, slug="another-project", name="Another Project"),
            Project(id=3, organization=org, slug="yet-another-project", name="Yet Another Project"),
        ]
        release = Release(
            organization_id=org.id,
            version="6c998f755f304593a4713abd123eaf8833a2de5e",
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

        repos = [
            {
                "name": "getsentry/getsentry",
                "commits": [
                    (
                        Commit(
                            key="48b86fcd677da3dba5679d7a738240ce6fb74b20",
                            date_added=datetime.datetime(2016, 10, 11, 15, 39, tzinfo=pytz.utc),
                        ),
                        None,
                    ),
                    (
                        Commit(
                            key="a53a2756bb8d111b43196210b34df90b87ed336b",
                            message="Fix billing",
                            author=CommitAuthor(name="David Cramer", email="david@sentry.io"),
                            date_added=datetime.datetime(2016, 10, 11, 16, 45, tzinfo=pytz.utc),
                        ),
                        User(email="david@sentry.io", name="David Cramer"),
                    ),
                ],
            },
            {
                "name": "getsentry/sentry",
                "commits": [
                    (
                        Commit(
                            key="3c8eb3b4af6ee2a29c68daa188fc730c8e4b39fd",
                            date_added=datetime.datetime(2016, 10, 10, 15, 39, tzinfo=pytz.utc),
                        ),
                        None,
                    ),
                    (
                        Commit(
                            key="373562702009df1692da6eb80a933139f29e094b",
                            message="Fix padding",
                            author=CommitAuthor(name="Chris Jennings", email="chris@sentry.io"),
                            date_added=datetime.datetime(2016, 10, 10, 16, 39, tzinfo=pytz.utc),
                        ),
                        None,
                    ),
                    (
                        Commit(
                            key="631cd9096bd9811a046a472bb0aa8b573e86e1f1",
                            message="Update README.rst",
                            author=CommitAuthor(name="David Cramer", email="david@sentry.io"),
                            date_added=datetime.datetime(2016, 10, 11, 10, 39, tzinfo=pytz.utc),
                        ),
                        User(email="david@sentry.io", name="David Cramer"),
                    ),
                ],
            },
        ]

        return MailPreview(
            html_template="sentry/emails/activity/release.html",
            text_template="sentry/emails/activity/release.txt",
            context={
                "release": release,
                "projects": zip(projects, release_links, [6, 1, 0]),
                "repos": repos,
                "reason": GroupSubscriptionReason.descriptions[GroupSubscriptionReason.committed],
                "project_count": len(projects),
                "commit_count": 4,
                "author_count": 1,
                "file_count": 5,
                "environment": "production",
                "deploy": deploy,
                "setup_repo_link": absolute_uri(f"/organizations/{org.slug}/repos/"),
            },
        ).render(request)

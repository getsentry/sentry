from __future__ import absolute_import

from datetime import datetime

import pytz
from django.views.generic import View

from sentry.models import (
    Commit, CommitAuthor, GroupSubscriptionReason, Organization, Project,
    Release, Team
)
from sentry.utils.http import absolute_uri

from .mail import MailPreview


class DebugNewReleaseEmailView(View):
    def get(self, request):
        org = Organization(
            id=1,
            slug='organization',
            name='My Company',
        )
        team = Team(
            id=1,
            slug='team',
            name='My Team',
            organization=org,
        )
        projects = [
            Project(
                id=1,
                organization=org,
                team=team,
                slug='project',
                name='My Project',
            ),
            Project(
                id=2,
                organization=org,
                team=team,
                slug='another-project',
                name='Another Project',
            ),
        ]
        release = Release(
            organization_id=org.id,
            version='6c998f755f304593a4713abd123eaf8833a2de5e',
            date_added=datetime(2016, 10, 12, 15, 39, tzinfo=pytz.utc)
        )

        release_links = [
            absolute_uri('/{}/{}/releases/{}/'.format(
                org.slug,
                p.slug,
                release.version,
            )) for p in projects
        ]

        repos = [{
            'name': 'getsentry/getsentry',
            'commits': [
                Commit(key='48b86fcd677da3dba5679d7a738240ce6fb74b20'),
                Commit(
                    key='a53a2756bb8d111b43196210b34df90b87ed336b',
                    message='Fix billing',
                    author=CommitAuthor(
                        name='David Cramer',
                        email='david@sentry.io',
                    )
                ),
            ],
        }, {
            'name': 'getsentry/sentry',
            'commits': [
                Commit(key='3c8eb3b4af6ee2a29c68daa188fc730c8e4b39fd'),
                Commit(
                    key='631cd9096bd9811a046a472bb0aa8b573e86e1f1',
                    message='Update README.rst',
                    author=CommitAuthor(
                        name='David Cramer',
                        email='david@sentry.io',
                    )
                ),
            ],
        }]

        return MailPreview(
            html_template='sentry/emails/activity/release.html',
            text_template='sentry/emails/activity/release.txt',
            context={
                'release': release,
                'projects': zip(projects, release_links, [6, 1]),
                'repos': repos,
                'reason': GroupSubscriptionReason.descriptions[
                    GroupSubscriptionReason.committed
                ],
                'project_count': len(projects),
                'commit_count': 4,
                'author_count': 1,
                'file_count': 5,
            },
        ).render(request)

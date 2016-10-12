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
        project = Project(
            id=1,
            organization=org,
            team=team,
            slug='project',
            name='My Project',
        )
        release = Release(
            project=project,
            version='6c998f755f304593a4713abd123eaf8833a2de5e',
            date_added=datetime(2016, 10, 12, 15, 39, tzinfo=pytz.utc)
        )

        release_link = absolute_uri('/{}/{}/releases/{}/'.format(
            org.slug,
            project.slug,
            release.version,
        ))

        project_link = absolute_uri('/{}/{}/'.format(
            org.slug,
            project.slug,
        ))

        commit_list = [
            Commit(key='48b86fcd677da3dba5679d7a738240ce6fb74b20'),
            Commit(
                key='a53a2756bb8d111b43196210b34df90b87ed336b',
                message='Update README.rst',
                author=CommitAuthor(
                    name='David Cramer',
                    email='david@sentry.io',
                )
            ),
        ]

        return MailPreview(
            html_template='sentry/emails/activity/release.html',
            text_template='sentry/emails/activity/release.txt',
            context={
                'release': release,
                'project': project,
                'release_link': release_link,
                'project_link': project_link,
                'commit_list': commit_list,
                'reason': GroupSubscriptionReason.descriptions[
                    GroupSubscriptionReason.committed
                ],
            },
        ).render(request)

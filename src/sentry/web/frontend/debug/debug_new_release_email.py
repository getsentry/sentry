from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.views.generic import View
from hashlib import sha1
from uuid import uuid4

from sentry.models import Organization, Team, Project, Release
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
            version=sha1(uuid4().bytes).hexdigest(),
        )

        release_link = absolute_uri('/{}/{}/releases/{}/'.format(
            org.slug,
            project.slug,
            release.version,
        ))

        project_link = absolute_uri(reverse('sentry-stream', kwargs={
            'organization_slug': org.slug,
            'project_id': project.slug,
        }))

        return MailPreview(
            html_template='sentry/emails/activity/release.html',
            text_template='sentry/emails/activity/release.txt',
            context={
                'release': release,
                'project': project,
                'release_link': release_link,
                'project_link': project_link,
            },
        ).render(request)

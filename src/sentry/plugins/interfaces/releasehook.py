"""
sentry.plugins.base.structs
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

__all__ = ['ReleaseHook']

import re

from django.db import transaction
from django.utils import timezone

from sentry.models import (
    Activity, Commit, CommitAuthor, Release, ReleaseCommit, Repository
)


class ReleaseHook(object):
    def __init__(self, project):
        self.project = project

    def _to_email(self, name):
        return re.sub(r'[^a-zA-Z0-9\-_\.]*', '', name).lower() + '@localhost'

    def start_release(self, version, **values):
        values.setdefault('date_started', timezone.now())
        values.setdefault('organization', self.project.organization_id)
        release, created = Release.objects.create_or_update(
            version=version,
            project=self.project,
            values=values
        )
        if created:
            release.add_project(self.project)

    # TODO(dcramer): this is being used by the release details endpoint, but
    # it'd be ideal if most if not all of this logic lived there, and this
    # hook simply called out to the endpoint
    def set_commits(self, version, commit_list):
        """
        Commits should be ordered oldest to newest.

        Calling this method will remove all existing commit history.
        """
        project = self.project
        release, created = Release.objects.get_or_create(
            project=project,
            version=version,
            defaults={'organization_id': self.project.organization_id}
        )
        if created:
            release.add_project(project)

        with transaction.atomic():
            # TODO(dcramer): would be good to optimize the logic to avoid these
            # deletes but not overly important
            ReleaseCommit.objects.filter(
                release=release,
            ).delete()

            authors = {}
            repos = {}
            for idx, data in enumerate(commit_list):
                repo_name = data.get('repository') or 'project-{}'.format(project.id)
                if repo_name not in repos:
                    repos[repo_name] = repo = Repository.objects.get_or_create(
                        organization_id=project.organization_id,
                        name=repo_name,
                    )[0]
                else:
                    repo = repos[repo_name]

                author_email = data.get('author_email')
                if author_email is None and data.get('author_name'):
                    author_email = self._to_email(data['author_name'])

                if not author_email:
                    author = None
                elif author_email not in authors:
                    authors[author_email] = author = CommitAuthor.objects.get_or_create(
                        organization_id=project.organization_id,
                        email=author_email,
                        defaults={
                            'name': data.get('author_name'),
                        }
                    )[0]
                    if data.get('author_name') and author.name != data['author_name']:
                        author.update(name=data['author_name'])
                else:
                    author = authors[author_email]

                commit = Commit.objects.get_or_create(
                    organization_id=project.organization_id,
                    repository_id=repo.id,
                    key=data['id'],
                    defaults={
                        'message': data.get('message'),
                        'author': author,
                        'date_added': data.get('timestamp') or timezone.now(),
                    }
                )[0]

                ReleaseCommit.objects.create(
                    organization_id=project.organization_id,
                    project_id=project.id,
                    release=release,
                    commit=commit,
                    order=idx,
                )

    def finish_release(self, version, **values):
        values.setdefault('date_released', timezone.now())
        values.setdefault('organization', self.project.organization_id)
        release, created = Release.objects.create_or_update(
            version=version,
            project=self.project,
            values=values
        )
        if created:
            release.add_project(self.project)
        activity = Activity.objects.create(
            type=Activity.RELEASE,
            project=self.project,
            ident=version,
            data={'version': version},
            datetime=values['date_released'],
        )
        activity.send_notification()

    def handle(self, request):
        raise NotImplementedError

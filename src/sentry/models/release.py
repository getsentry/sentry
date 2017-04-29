"""
sentry.models.release
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import re

from django.db import models, IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from jsonfield import JSONField

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)


_sha1_re = re.compile(r'^[a-f0-9]{40}$')
_dotted_path_prefix_re = re.compile(r'^([a-z][a-z0-9-]+)(\.[a-z][a-z0-9-]+)+-')


class ReleaseProject(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    release = FlexibleForeignKey('sentry.Release')
    new_groups = BoundedPositiveIntegerField(null=True, default=0)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_release_project'
        unique_together = (('project', 'release'),)


class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.
    """
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    projects = models.ManyToManyField('sentry.Project', related_name='releases',
                                      through=ReleaseProject)
    project_id = BoundedPositiveIntegerField(null=True)
    version = models.CharField(max_length=64)
    # ref might be the branch name being released
    ref = models.CharField(max_length=64, null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    date_added = models.DateTimeField(default=timezone.now)
    # DEPRECATED - not available in UI or editable from API
    date_started = models.DateTimeField(null=True, blank=True)
    date_released = models.DateTimeField(null=True, blank=True)
    # arbitrary data recorded with the release
    data = JSONField(default={})
    new_groups = BoundedPositiveIntegerField(default=0)
    # generally the release manager, or the person initiating the process
    owner = FlexibleForeignKey('sentry.User', null=True, blank=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_release'
        unique_together = (('organization', 'version'),)

    __repr__ = sane_repr('organization', 'version')

    @classmethod
    def get_cache_key(cls, organization_id, version):
        return 'release:3:%s:%s' % (organization_id, md5_text(version).hexdigest())

    @classmethod
    def get(cls, project, version):
        cache_key = cls.get_cache_key(project.organization_id, version)

        release = cache.get(cache_key)
        if release is None:
            try:
                release = cls.objects.get(
                    organization_id=project.organization_id,
                    projects=project,
                    version=version,
                )
            except cls.DoesNotExist:
                release = -1
            cache.set(cache_key, release, 300)

        if release == -1:
            return

        return release

    @classmethod
    def get_or_create(cls, project, version, date_added=None):
        from sentry.models import Project

        if date_added is None:
            date_added = timezone.now()

        cache_key = cls.get_cache_key(project.organization_id, version)

        release = cache.get(cache_key)
        if release in (None, -1):
            # TODO(dcramer): if the cache result is -1 we could attempt a
            # default create here instead of default get
            project_version = ('%s-%s' % (project.slug, version))[:64]
            releases = list(cls.objects.filter(
                organization_id=project.organization_id,
                version__in=[version, project_version],
                projects=project
            ))
            if releases:
                try:
                    release = [r for r in releases if r.version == project_version][0]
                except IndexError:
                    release = releases[0]
            else:
                try:
                    with transaction.atomic():
                        release = cls.objects.create(
                            organization_id=project.organization_id,
                            version=version,
                            date_added=date_added
                        )
                except IntegrityError:
                    release = cls.objects.get(
                        organization_id=project.organization_id,
                        version=version
                    )
                release.add_project(project)
                if not project.flags.has_releases:
                    project.flags.has_releases = True
                    project.update(flags=F('flags').bitor(Project.flags.has_releases))

            # TODO(dcramer): upon creating a new release, check if it should be
            # the new "latest release" for this project
            cache.set(cache_key, release, 3600)

        return release

    @classmethod
    def merge(cls, to_release, from_releases):
        # The following models reference release:
        # ReleaseCommit.release
        # ReleaseEnvironment.release_id
        # ReleaseProject.release
        # GroupRelease.release_id
        # GroupResolution.release
        # Group.first_release
        # ReleaseFile.release

        from sentry.models import (
            ReleaseCommit, ReleaseEnvironment, ReleaseFile, ReleaseProject,
            Group, GroupRelease, GroupResolution
        )

        model_list = (
            ReleaseCommit, ReleaseEnvironment, ReleaseFile, ReleaseProject,
            GroupRelease, GroupResolution
        )
        for release in from_releases:
            for model in model_list:
                if hasattr(model, 'release'):
                    update_kwargs = {'release': to_release}
                else:
                    update_kwargs = {'release_id': to_release.id}
                try:
                    with transaction.atomic():
                        model.objects.filter(
                            release_id=release.id
                        ).update(**update_kwargs)
                except IntegrityError:
                    for item in model.objects.filter(release_id=release.id):
                        try:
                            with transaction.atomic():
                                model.objects.filter(
                                    id=item.id
                                ).update(**update_kwargs)
                        except IntegrityError:
                            item.delete()

            Group.objects.filter(
                first_release=release
            ).update(first_release=to_release)

            release.delete()

    @property
    def short_version(self):
        version = self.version
        match = _dotted_path_prefix_re.match(version)
        if match is not None:
            version = version[match.end():]
        if _sha1_re.match(version):
            return version[:12]
        return version

    def add_dist(self, name, date_added=None):
        from sentry.models import Distribution
        if date_added is None:
            date_added = timezone.now()
        return Distribution.objects.get_or_create(
            release=self,
            name=name,
            defaults={
                'date_added': date_added,
                'organization_id': self.organization_id,
            }
        )[0]

    def get_dist(self, name):
        from sentry.models import Distribution
        try:
            return Distribution.objects.get(
                name=name,
                release=self
            )
        except Distribution.DoesNotExist:
            pass

    def add_project(self, project):
        """
        Add a project to this release.

        Returns True if the project was added and did not already exist.
        """
        from sentry.models import Project
        try:
            with transaction.atomic():
                ReleaseProject.objects.create(project=project, release=self)
                if not project.flags.has_releases:
                    project.flags.has_releases = True
                    project.update(
                        flags=F('flags').bitor(Project.flags.has_releases),
                    )
        except IntegrityError:
            return False
        else:
            return True

    def set_refs(self, refs, user, fetch=False):
        from sentry.models import Commit, ReleaseHeadCommit, Repository
        from sentry.tasks.commits import fetch_commits

        # TODO: this does the wrong thing unless you are on the most
        # recent release.  Add a timestamp compare?
        prev_release = type(self).objects.filter(
            organization_id=self.organization_id,
            projects__in=self.projects.all(),
        ).exclude(version=self.version).order_by('-date_added').first()

        for ref in refs:
            try:
                repo = Repository.objects.get(
                    organization_id=self.organization_id,
                    name=ref['repository'],
                )
            except Repository.DoesNotExist:
                continue

            commit = Commit.objects.get_or_create(
                organization_id=self.organization_id,
                repository_id=repo.id,
                key=ref['commit'],
            )[0]
            # update head commit for repo/release if exists
            ReleaseHeadCommit.objects.create_or_update(
                organization_id=self.organization_id,
                repository_id=repo.id,
                release=self,
                values={
                    'commit': commit,
                }
            )
        if fetch:
            fetch_commits.apply_async(
                kwargs={
                    'release_id': self.id,
                    'user_id': user.id,
                    'refs': refs,
                    'prev_release_id': prev_release and prev_release.id,
                }
            )

    def set_commits(self, commit_list):
        from sentry.models import (
            Commit, CommitAuthor, Group, GroupCommitResolution, GroupResolution,
            GroupResolutionStatus, GroupStatus, ReleaseCommit, Repository
        )

        with transaction.atomic():
            # TODO(dcramer): would be good to optimize the logic to avoid these
            # deletes but not overly important
            ReleaseCommit.objects.filter(
                release=self,
            ).delete()

            authors = {}
            repos = {}
            for idx, data in enumerate(commit_list):
                repo_name = data.get('repository') or 'organization-{}'.format(self.organization_id)
                if repo_name not in repos:
                    repos[repo_name] = repo = Repository.objects.get_or_create(
                        organization_id=self.organization_id,
                        name=repo_name,
                    )[0]
                else:
                    repo = repos[repo_name]

                author_email = data.get('author_email')
                if author_email is None and data.get('author_name'):
                    author_email = (re.sub(r'[^a-zA-Z0-9\-_\.]*', '', data['author_name']).lower() +
                                    '@localhost')

                if not author_email:
                    author = None
                elif author_email not in authors:
                    authors[author_email] = author = CommitAuthor.objects.get_or_create(
                        organization_id=self.organization_id,
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
                    organization_id=self.organization_id,
                    repository_id=repo.id,
                    key=data['id'],
                    defaults={
                        'message': data.get('message'),
                        'author': author,
                        'date_added': data.get('timestamp') or timezone.now(),
                    }
                )[0]

                ReleaseCommit.objects.create(
                    organization_id=self.organization_id,
                    release=self,
                    commit=commit,
                    order=idx,
                )

        group_ids = list(GroupCommitResolution.objects.filter(
            commit_id__in=ReleaseCommit.objects.filter(
                release=self
            ).values_list('commit_id', flat=True),
        ).values_list('group_id', flat=True))
        for group_id in group_ids:
            GroupResolution.objects.create_or_update(
                group_id=group_id,
                release=self,
                values={
                    'status': GroupResolutionStatus.RESOLVED,
                },
            )

        Group.objects.filter(
            id__in=group_ids,
        ).update(status=GroupStatus.RESOLVED)

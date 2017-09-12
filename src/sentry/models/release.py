"""
sentry.models.release
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging
import re
import six

from django.db import models, IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from jsonfield import JSONField

from sentry.app import locks
from sentry.db.models import (
    ArrayField, BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)

from sentry.models import CommitFileChange

from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger(__name__)

_sha1_re = re.compile(r'^[a-f0-9]{40}$')
_dotted_path_prefix_re = re.compile(r'^([a-zA-Z][a-zA-Z0-9-]+)(\.[a-zA-Z][a-zA-Z0-9-]+)+-')
BAD_RELEASE_CHARS = '\n\f\t/'


class ReleaseProject(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    release = FlexibleForeignKey('sentry.Release')
    new_groups = BoundedPositiveIntegerField(null=True, default=0)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_release_project'
        unique_together = (('project', 'release'), )


class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.
    """
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    projects = models.ManyToManyField(
        'sentry.Project', related_name='releases', through=ReleaseProject
    )
    # DEPRECATED
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

    # materialized stats
    commit_count = BoundedPositiveIntegerField(null=True)
    last_commit_id = BoundedPositiveIntegerField(null=True)
    authors = ArrayField(null=True)
    total_deploys = BoundedPositiveIntegerField(null=True)
    last_deploy_id = BoundedPositiveIntegerField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_release'
        unique_together = (('organization', 'version'), )

    __repr__ = sane_repr('organization', 'version')

    @staticmethod
    def is_valid_version(value):
        return not (any(c in value for c in BAD_RELEASE_CHARS)
                    or value in ('.', '..') or not value)

    @classmethod
    def get_cache_key(cls, organization_id, version):
        return 'release:3:%s:%s' % (organization_id, md5_text(version).hexdigest())

    @classmethod
    def get_lock_key(cls, organization_id, release_id):
        return 'releasecommits:{}:{}'.format(organization_id, release_id)

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
            releases = list(
                cls.objects.filter(
                    organization_id=project.organization_id,
                    version__in=[version, project_version],
                    projects=project
                )
            )
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
                            date_added=date_added,
                            total_deploys=0,
                        )
                except IntegrityError:
                    release = cls.objects.get(
                        organization_id=project.organization_id, version=version
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
            ReleaseCommit, ReleaseEnvironment, ReleaseFile, ReleaseProject, Group, GroupRelease,
            GroupResolution
        )

        model_list = (
            ReleaseCommit, ReleaseEnvironment, ReleaseFile, ReleaseProject, GroupRelease,
            GroupResolution
        )
        for release in from_releases:
            for model in model_list:
                if hasattr(model, 'release'):
                    update_kwargs = {'release': to_release}
                else:
                    update_kwargs = {'release_id': to_release.id}
                try:
                    with transaction.atomic():
                        model.objects.filter(release_id=release.id).update(**update_kwargs)
                except IntegrityError:
                    for item in model.objects.filter(release_id=release.id):
                        try:
                            with transaction.atomic():
                                model.objects.filter(id=item.id).update(**update_kwargs)
                        except IntegrityError:
                            item.delete()

            Group.objects.filter(first_release=release).update(first_release=to_release)

            release.delete()

    @classmethod
    def get_closest_releases(cls, project, start_version, limit=5):
        # given a release version + project, return next
        # `limit` releases (includes the release specified by `version`)
        try:
            release_dates = cls.objects.filter(
                organization_id=project.organization_id,
                version=start_version,
                projects=project,
            ).values('date_released', 'date_added').get()
        except cls.DoesNotExist:
            return []

        start_date = release_dates['date_released'] or release_dates['date_added']

        return list(Release.objects.filter(
            projects=project,
            organization_id=project.organization_id,
        ).extra(select={
                'date': 'COALESCE(date_released, date_added)',
                }
                ).extra(
            where=["COALESCE(date_released, date_added) >= %s"],
            params=[start_date]
        ).extra(
            order_by=['date']
        )[:limit])

    @property
    def short_version(self):
        version = self.version
        match = _dotted_path_prefix_re.match(version)
        if match is not None:
            version = version[match.end():]
        if _sha1_re.match(version):
            return version[:7]
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
            return Distribution.objects.get(name=name, release=self)
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
        from sentry.api.exceptions import InvalidRepository
        from sentry.models import Commit, ReleaseHeadCommit, Repository
        from sentry.tasks.commits import fetch_commits

        # TODO: this does the wrong thing unless you are on the most
        # recent release.  Add a timestamp compare?
        prev_release = type(self).objects.filter(
            organization_id=self.organization_id,
            projects__in=self.projects.all(),
        ).exclude(version=self.version).order_by('-date_added').first()

        names = {r['repository'] for r in refs}
        repos = list(
            Repository.objects.filter(
                organization_id=self.organization_id,
                name__in=names,
            )
        )
        repos_by_name = {r.name: r for r in repos}
        invalid_repos = names - set(repos_by_name.keys())
        if invalid_repos:
            raise InvalidRepository('Invalid repository names: %s' % ','.join(invalid_repos))

        for ref in refs:
            repo = repos_by_name[ref['repository']]

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
        """
        Bind a list of commits to this release.

        These should be ordered from newest to oldest.

        This will clear any existing commit log and replace it with the given
        commits.
        """
        from sentry.models import (
            Commit, CommitAuthor, Group, GroupCommitResolution, GroupResolution, GroupStatus,
            ReleaseCommit, Repository
        )
        from sentry.plugins.providers.repository import RepositoryProvider

        commit_list = [
            c for c in commit_list
            if not RepositoryProvider.should_ignore_commit(c.get('message', ''))
        ]

        lock_key = type(self).get_lock_key(self.organization_id, self.id)
        lock = locks.get(lock_key, duration=10)
        with TimedRetryPolicy(10)(lock.acquire):
            with transaction.atomic():
                # TODO(dcramer): would be good to optimize the logic to avoid these
                # deletes but not overly important
                ReleaseCommit.objects.filter(
                    release=self,
                ).delete()

                authors = {}
                repos = {}
                commit_author_by_commit = {}
                latest_commit = None
                for idx, data in enumerate(commit_list):
                    repo_name = data.get('repository'
                                         ) or 'organization-{}'.format(self.organization_id)
                    if repo_name not in repos:
                        repos[repo_name] = repo = Repository.objects.get_or_create(
                            organization_id=self.organization_id,
                            name=repo_name,
                        )[0]
                    else:
                        repo = repos[repo_name]

                    author_email = data.get('author_email')
                    if author_email is None and data.get('author_name'):
                        author_email = (
                            re.sub(r'[^a-zA-Z0-9\-_\.]*', '', data['author_name']).lower() +
                            '@localhost'
                        )

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

                    defaults = {
                        'message': data.get('message'),
                        'author': author,
                        'date_added': data.get('timestamp') or timezone.now(),
                    }
                    commit, created = Commit.objects.get_or_create(
                        organization_id=self.organization_id,
                        repository_id=repo.id,
                        key=data['id'],
                        defaults=defaults,
                    )
                    if author is None:
                        author = commit.author

                    commit_author_by_commit[commit.id] = author

                    patch_set = data.get('patch_set', [])

                    for patched_file in patch_set:
                        CommitFileChange.objects.get_or_create(
                            organization_id=self.organization.id,
                            commit=commit,
                            filename=patched_file['path'],
                            type=patched_file['type'],
                        )

                    if not created:
                        update_kwargs = {}
                        if commit.message is None and defaults['message'] is not None:
                            update_kwargs['message'] = defaults['message']
                        if commit.author_id is None and defaults['author'] is not None:
                            update_kwargs['author'] = defaults['author']
                        if update_kwargs:
                            commit.update(**update_kwargs)

                    ReleaseCommit.objects.create(
                        organization_id=self.organization_id,
                        release=self,
                        commit=commit,
                        order=idx,
                    )
                    if latest_commit is None:
                        latest_commit = commit

                self.update(
                    commit_count=len(commit_list),
                    authors=[
                        six.text_type(a_id)
                        for a_id in ReleaseCommit.objects.filter(
                            release=self,
                            commit__author_id__isnull=False,
                        ).values_list('commit__author_id', flat=True).distinct()
                    ],
                    last_commit_id=latest_commit.id if latest_commit else None,
                )

        commit_resolutions = list(
            GroupCommitResolution.objects.filter(
                commit_id__in=ReleaseCommit.objects.filter(release=self)
                .values_list('commit_id', flat=True),
            ).values_list('group_id', 'commit_id')
        )
        user_by_author = {None: None}
        for group_id, commit_id in commit_resolutions:
            author = commit_author_by_commit.get(commit_id)
            if author not in user_by_author:
                try:
                    user_by_author[author] = author.find_users()[0]
                except IndexError:
                    user_by_author[author] = None
            actor = user_by_author[author]

            with transaction.atomic():
                GroupResolution.objects.create_or_update(
                    group_id=group_id,
                    values={
                        'release': self,
                        'type': GroupResolution.Type.in_release,
                        'status': GroupResolution.Status.resolved,
                        'actor_id': actor.id if actor else None,
                    },
                )
                Group.objects.filter(
                    id=group_id,
                ).update(status=GroupStatus.RESOLVED)

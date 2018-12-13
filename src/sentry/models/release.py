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
import itertools

from django.db import models, IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from jsonfield import JSONField
from time import time

from sentry.app import locks
from sentry.db.models import (
    ArrayField, BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
)

from sentry.models import CommitFileChange

from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger(__name__)

_sha1_re = re.compile(r'^[a-f0-9]{40}$')
_dotted_path_prefix_re = re.compile(r'^([a-zA-Z][a-zA-Z0-9-]+)(\.[a-zA-Z][a-zA-Z0-9-]+)+-')
BAD_RELEASE_CHARS = '\n\f\t/'
DB_VERSION_LENGTH = 250


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
    version = models.CharField(max_length=DB_VERSION_LENGTH)
    # ref might be the branch name being released
    ref = models.CharField(max_length=DB_VERSION_LENGTH, null=True, blank=True)
    url = models.URLField(null=True, blank=True)
    date_added = models.DateTimeField(default=timezone.now)
    # DEPRECATED - not available in UI or editable from API
    date_started = models.DateTimeField(null=True, blank=True)
    date_released = models.DateTimeField(null=True, blank=True)
    # arbitrary data recorded with the release
    data = JSONField(default={})
    new_groups = BoundedPositiveIntegerField(default=0)
    # generally the release manager, or the person initiating the process
    owner = FlexibleForeignKey('sentry.User', null=True, blank=True, on_delete=models.SET_NULL)

    # materialized stats
    commit_count = BoundedPositiveIntegerField(null=True, default=0)
    last_commit_id = BoundedPositiveIntegerField(null=True)
    authors = ArrayField(null=True)
    total_deploys = BoundedPositiveIntegerField(null=True, default=0)
    last_deploy_id = BoundedPositiveIntegerField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_release'
        unique_together = (('organization', 'version'), )

    __repr__ = sane_repr('organization_id', 'version')

    @staticmethod
    def is_valid_version(value):
        return not (any(c in value for c in BAD_RELEASE_CHARS)
                    or value in ('.', '..') or not value)

    @classmethod
    def get_cache_key(cls, organization_id, version):
        return 'release:3:%s:%s' % (organization_id, md5_text(version).hexdigest())

    @classmethod
    def get_lock_key(cls, organization_id, release_id):
        return u'releasecommits:{}:{}'.format(organization_id, release_id)

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
            project_version = ('%s-%s' % (project.slug, version))[:DB_VERSION_LENGTH]
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
            ReleaseCommit, ReleaseEnvironment, ReleaseFile, ReleaseProject, ReleaseProjectEnvironment, Group, GroupRelease,
            GroupResolution
        )

        model_list = (
            ReleaseCommit, ReleaseEnvironment, ReleaseFile, ReleaseProject, ReleaseProjectEnvironment, GroupRelease,
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

    @property
    def short_version(self):
        return Release.get_display_version(self.version)

    @staticmethod
    def get_display_version(version):
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
        ).extra(select={
            'sort': 'COALESCE(date_released, date_added)',
        }).exclude(version=self.version).order_by('-sort').first()

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

        This will clear any existing commit log and replace it with the given
        commits.
        """

        # Sort commit list in reverse order
        commit_list.sort(key=lambda commit: commit.get('timestamp'), reverse=True)

        # TODO(dcramer): this function could use some cleanup/refactoring as its a bit unwieldly
        from sentry.models import (
            Commit, CommitAuthor, Group, GroupLink, GroupResolution, GroupStatus,
            ReleaseCommit, ReleaseHeadCommit, Repository, PullRequest
        )
        from sentry.plugins.providers.repository import RepositoryProvider
        from sentry.tasks.integrations import kick_off_status_syncs
        # todo(meredith): implement for IntegrationRepositoryProvider
        commit_list = [
            c for c in commit_list
            if not RepositoryProvider.should_ignore_commit(c.get('message', ''))
        ]
        lock_key = type(self).get_lock_key(self.organization_id, self.id)
        lock = locks.get(lock_key, duration=10)
        with TimedRetryPolicy(10)(lock.acquire):
            start = time()
            with transaction.atomic():
                # TODO(dcramer): would be good to optimize the logic to avoid these
                # deletes but not overly important
                ReleaseCommit.objects.filter(
                    release=self,
                ).delete()

                authors = {}
                repos = {}
                commit_author_by_commit = {}
                head_commit_by_repo = {}
                latest_commit = None
                for idx, data in enumerate(commit_list):
                    repo_name = data.get('repository'
                                         ) or u'organization-{}'.format(self.organization_id)
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
                        if defaults.get('date_added') is not None:
                            update_kwargs['date_added'] = defaults['date_added']
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

                    head_commit_by_repo.setdefault(repo.id, commit.id)

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
                metrics.timing('release.set_commits.duration', time() - start)

        # fill any missing ReleaseHeadCommit entries
        for repo_id, commit_id in six.iteritems(head_commit_by_repo):
            try:
                with transaction.atomic():
                    ReleaseHeadCommit.objects.create(
                        organization_id=self.organization_id,
                        release_id=self.id,
                        repository_id=repo_id,
                        commit_id=commit_id,
                    )
            except IntegrityError:
                pass

        release_commits = list(ReleaseCommit.objects.filter(release=self)
                               .select_related('commit').values('commit_id', 'commit__key'))

        commit_resolutions = list(
            GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.commit,
                linked_id__in=[rc['commit_id'] for rc in release_commits],
            ).values_list('group_id', 'linked_id')
        )

        commit_group_authors = [
            (cr[0],  # group_id
             commit_author_by_commit.get(cr[1])) for cr in commit_resolutions]

        pr_ids_by_merge_commit = list(PullRequest.objects.filter(
            merge_commit_sha__in=[rc['commit__key'] for rc in release_commits],
            organization_id=self.organization_id,
        ).values_list('id', flat=True))

        pull_request_resolutions = list(
            GroupLink.objects.filter(
                relationship=GroupLink.Relationship.resolves,
                linked_type=GroupLink.LinkedType.pull_request,
                linked_id__in=pr_ids_by_merge_commit,
            ).values_list('group_id', 'linked_id')
        )

        pr_authors = list(PullRequest.objects.filter(
            id__in=[prr[1] for prr in pull_request_resolutions],
        ).select_related('author'))

        pr_authors_dict = {
            pra.id: pra.author for pra in pr_authors
        }

        pull_request_group_authors = [(prr[0], pr_authors_dict.get(prr[1]))
                                      for prr in pull_request_resolutions]

        user_by_author = {None: None}

        commits_and_prs = list(
            itertools.chain(commit_group_authors, pull_request_group_authors),
        )

        group_project_lookup = dict(Group.objects.filter(
            id__in=[group_id for group_id, _ in commits_and_prs],
        ).values_list('id', 'project_id'))

        for group_id, author in commits_and_prs:
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
                metrics.incr('group.resolved', instance='in_commit', skip_internal=True)

            kick_off_status_syncs.apply_async(kwargs={
                'project_id': group_project_lookup[group_id],
                'group_id': group_id,
            })

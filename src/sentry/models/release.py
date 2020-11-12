from __future__ import absolute_import, print_function

import logging
import re
import six
import sentry_sdk
import itertools

from django.db import models, IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.translation import ugettext_lazy as _
from time import time

from sentry.app import locks
from sentry.db.models import (
    ArrayField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    sane_repr,
)

from sentry_relay import parse_release, RelayError
from sentry.constants import BAD_RELEASE_CHARS, COMMIT_RANGE_DELIMITER
from sentry.models import CommitFileChange, remove_group_from_inbox
from sentry.signals import issue_resolved
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text
from sentry.utils.retries import TimedRetryPolicy
from sentry.utils.strings import truncatechars

logger = logging.getLogger(__name__)

_sha1_re = re.compile(r"^[a-f0-9]{40}$")
_dotted_path_prefix_re = re.compile(r"^([a-zA-Z][a-zA-Z0-9-]+)(\.[a-zA-Z][a-zA-Z0-9-]+)+-")
DB_VERSION_LENGTH = 250


ERR_RELEASE_REFERENCED = "This release is referenced by active issues and cannot be removed."
ERR_RELEASE_HEALTH_DATA = "This release has health data and cannot be removed."


class UnsafeReleaseDeletion(Exception):
    pass


class ReleaseCommitError(Exception):
    pass


class ReleaseProject(Model):
    __core__ = False

    project = FlexibleForeignKey("sentry.Project")
    release = FlexibleForeignKey("sentry.Release")
    new_groups = BoundedPositiveIntegerField(null=True, default=0)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_release_project"
        unique_together = (("project", "release"),)


class ReleaseStatus(object):
    OPEN = 0
    ARCHIVED = 1

    @classmethod
    def from_string(cls, value):
        if value == "open":
            return cls.OPEN
        elif value == "archived":
            return cls.ARCHIVED
        else:
            raise ValueError(repr(value))

    @classmethod
    def to_string(cls, value):
        # XXX(markus): Since the column is nullable we need to handle `null` here.
        # However `null | undefined` in request payloads means "don't change
        # status of release". This is why `from_string` does not consider
        # `null` valid.
        #
        # We could remove `0` as valid state and only have `null` but I think
        # that would make things worse.
        #
        # Eventually we should backfill releasestatus to 0
        if value is None or value == ReleaseStatus.OPEN:
            return "open"
        elif value == ReleaseStatus.ARCHIVED:
            return "archived"
        else:
            raise ValueError(repr(value))


class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.

    A commit is generally a git commit. See also releasecommit.py
    """

    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    projects = models.ManyToManyField(
        "sentry.Project", related_name="releases", through=ReleaseProject
    )
    status = BoundedPositiveIntegerField(
        default=ReleaseStatus.OPEN,
        null=True,
        choices=((ReleaseStatus.OPEN, _("Open")), (ReleaseStatus.ARCHIVED, _("Archived")),),
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
    # new issues (groups) that arise as a consequence of this release
    new_groups = BoundedPositiveIntegerField(default=0)
    # generally the release manager, or the person initiating the process
    owner = FlexibleForeignKey("sentry.User", null=True, blank=True, on_delete=models.SET_NULL)

    # materialized stats
    commit_count = BoundedPositiveIntegerField(null=True, default=0)
    last_commit_id = BoundedPositiveIntegerField(null=True)
    authors = ArrayField(null=True)
    total_deploys = BoundedPositiveIntegerField(null=True, default=0)
    last_deploy_id = BoundedPositiveIntegerField(null=True)

    # HACK HACK HACK
    # As a transitionary step we permit release rows to exist multiple times
    # where they are "specialized" for a specific project.  The goal is to
    # later split up releases by project again.  This is for instance used
    # by the org release listing.
    _for_project_id = None

    class Meta:
        app_label = "sentry"
        db_table = "sentry_release"
        unique_together = (("organization", "version"),)

    __repr__ = sane_repr("organization_id", "version")

    def __eq__(self, other):
        """Make sure that specialized releases are only comparable to the same
        other specialized release.  This for instance lets us treat them
        separately for serialization purposes.
        """
        return Model.__eq__(self, other) and self._for_project_id == other._for_project_id

    @staticmethod
    def is_valid_version(value):
        return not (
            not value
            or any(c in value for c in BAD_RELEASE_CHARS)
            or value in (".", "..")
            or value.lower() == "latest"
        )

    @classmethod
    def get_cache_key(cls, organization_id, version):
        return "release:3:%s:%s" % (organization_id, md5_text(version).hexdigest())

    @classmethod
    def get_lock_key(cls, organization_id, release_id):
        return u"releasecommits:{}:{}".format(organization_id, release_id)

    @classmethod
    def get(cls, project, version):
        cache_key = cls.get_cache_key(project.organization_id, version)

        release = cache.get(cache_key)
        if release is None:
            try:
                release = cls.objects.get(
                    organization_id=project.organization_id, projects=project, version=version
                )
            except cls.DoesNotExist:
                release = -1
            cache.set(cache_key, release, 300)

        if release == -1:
            return

        return release

    @classmethod
    def get_or_create(cls, project, version, date_added=None):
        with metrics.timer("models.release.get_or_create") as metric_tags:
            return cls._get_or_create_impl(project, version, date_added, metric_tags)

    @classmethod
    def _get_or_create_impl(cls, project, version, date_added, metric_tags):
        from sentry.models import Project

        if date_added is None:
            date_added = timezone.now()

        cache_key = cls.get_cache_key(project.organization_id, version)

        release = cache.get(cache_key)

        if release in (None, -1):
            # TODO(dcramer): if the cache result is -1 we could attempt a
            # default create here instead of default get
            project_version = ("%s-%s" % (project.slug, version))[:DB_VERSION_LENGTH]
            releases = list(
                cls.objects.filter(
                    organization_id=project.organization_id,
                    version__in=[version, project_version],
                    projects=project,
                )
            )

            if releases:
                try:
                    release = [r for r in releases if r.version == project_version][0]
                except IndexError:
                    release = releases[0]
                metric_tags["created"] = "false"
            else:
                try:
                    with transaction.atomic():
                        release = cls.objects.create(
                            organization_id=project.organization_id,
                            version=version,
                            date_added=date_added,
                            total_deploys=0,
                        )

                    metric_tags["created"] = "true"
                except IntegrityError:
                    metric_tags["created"] = "false"
                    release = cls.objects.get(
                        organization_id=project.organization_id, version=version
                    )

                release.add_project(project)
                if not project.flags.has_releases:
                    project.flags.has_releases = True
                    project.update(flags=F("flags").bitor(Project.flags.has_releases))

            # TODO(dcramer): upon creating a new release, check if it should be
            # the new "latest release" for this project
            cache.set(cache_key, release, 3600)
            metric_tags["cache_hit"] = "false"
        else:
            metric_tags["cache_hit"] = "true"

        return release

    @cached_property
    def version_info(self):
        try:
            return parse_release(self.version)
        except RelayError:
            # This can happen on invalid legacy releases
            return None

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
            ReleaseCommit,
            ReleaseEnvironment,
            ReleaseFile,
            ReleaseProject,
            ReleaseProjectEnvironment,
            Group,
            GroupRelease,
            GroupResolution,
        )

        model_list = (
            ReleaseCommit,
            ReleaseEnvironment,
            ReleaseFile,
            ReleaseProject,
            ReleaseProjectEnvironment,
            GroupRelease,
            GroupResolution,
        )
        for release in from_releases:
            for model in model_list:
                if hasattr(model, "release"):
                    update_kwargs = {"release": to_release}
                else:
                    update_kwargs = {"release_id": to_release.id}
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

    def add_dist(self, name, date_added=None):
        from sentry.models import Distribution

        if date_added is None:
            date_added = timezone.now()
        return Distribution.objects.get_or_create(
            release=self,
            name=name,
            defaults={"date_added": date_added, "organization_id": self.organization_id},
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
                    project.update(flags=F("flags").bitor(Project.flags.has_releases))
        except IntegrityError:
            return False
        else:
            return True

    def handle_commit_ranges(self, refs):
        """
        Takes commit refs of the form:
        [
            {
                'previousCommit': None,
                'commit': 'previous_commit..commit',
            }
        ]
        Note: Overwrites 'previousCommit' and 'commit'
        """
        for ref in refs:
            if COMMIT_RANGE_DELIMITER in ref["commit"]:
                ref["previousCommit"], ref["commit"] = ref["commit"].split(COMMIT_RANGE_DELIMITER)

    def set_refs(self, refs, user, fetch=False):
        with sentry_sdk.start_span(op="set_refs"):
            from sentry.api.exceptions import InvalidRepository
            from sentry.models import Commit, ReleaseHeadCommit, Repository
            from sentry.tasks.commits import fetch_commits

            # TODO: this does the wrong thing unless you are on the most
            # recent release.  Add a timestamp compare?
            prev_release = (
                type(self)
                .objects.filter(
                    organization_id=self.organization_id, projects__in=self.projects.all()
                )
                .extra(select={"sort": "COALESCE(date_released, date_added)"})
                .exclude(version=self.version)
                .order_by("-sort")
                .first()
            )

            names = {r["repository"] for r in refs}
            repos = list(
                Repository.objects.filter(organization_id=self.organization_id, name__in=names)
            )
            repos_by_name = {r.name: r for r in repos}
            invalid_repos = names - set(repos_by_name.keys())
            if invalid_repos:
                raise InvalidRepository("Invalid repository names: %s" % ",".join(invalid_repos))

            self.handle_commit_ranges(refs)

            for ref in refs:
                repo = repos_by_name[ref["repository"]]

                commit = Commit.objects.get_or_create(
                    organization_id=self.organization_id, repository_id=repo.id, key=ref["commit"]
                )[0]
                # update head commit for repo/release if exists
                ReleaseHeadCommit.objects.create_or_update(
                    organization_id=self.organization_id,
                    repository_id=repo.id,
                    release=self,
                    values={"commit": commit},
                )
            if fetch:
                fetch_commits.apply_async(
                    kwargs={
                        "release_id": self.id,
                        "user_id": user.id,
                        "refs": refs,
                        "prev_release_id": prev_release and prev_release.id,
                    }
                )

    def set_commits(self, commit_list):
        """
        Bind a list of commits to this release.

        This will clear any existing commit log and replace it with the given
        commits.
        """

        # Sort commit list in reverse order
        commit_list.sort(key=lambda commit: commit.get("timestamp", 0), reverse=True)

        # TODO(dcramer): this function could use some cleanup/refactoring as it's a bit unwieldy
        from sentry.models import (
            Commit,
            CommitAuthor,
            Group,
            GroupLink,
            GroupResolution,
            GroupStatus,
            ReleaseCommit,
            ReleaseHeadCommit,
            Repository,
            PullRequest,
        )
        from sentry.plugins.providers.repository import RepositoryProvider
        from sentry.tasks.integrations import kick_off_status_syncs

        # todo(meredith): implement for IntegrationRepositoryProvider
        commit_list = [
            c
            for c in commit_list
            if not RepositoryProvider.should_ignore_commit(c.get("message", ""))
        ]
        lock_key = type(self).get_lock_key(self.organization_id, self.id)
        lock = locks.get(lock_key, duration=10)
        if lock.locked():
            # Signal failure to the consumer rapidly. This aims to prevent the number
            # of timeouts and prevent web worker exhaustion when customers create
            # the same release rapidly for different projects.
            raise ReleaseCommitError
        with TimedRetryPolicy(10)(lock.acquire):
            start = time()
            with transaction.atomic():
                # TODO(dcramer): would be good to optimize the logic to avoid these
                # deletes but not overly important
                ReleaseCommit.objects.filter(release=self).delete()

                authors = {}
                repos = {}
                commit_author_by_commit = {}
                head_commit_by_repo = {}
                latest_commit = None
                for idx, data in enumerate(commit_list):
                    repo_name = data.get("repository") or u"organization-{}".format(
                        self.organization_id
                    )
                    if repo_name not in repos:
                        repos[repo_name] = repo = Repository.objects.get_or_create(
                            organization_id=self.organization_id, name=repo_name
                        )[0]
                    else:
                        repo = repos[repo_name]

                    author_email = data.get("author_email")
                    if author_email is None and data.get("author_name"):
                        author_email = (
                            re.sub(r"[^a-zA-Z0-9\-_\.]*", "", data["author_name"]).lower()
                            + "@localhost"
                        )

                    author_email = truncatechars(author_email, 75)

                    if not author_email:
                        author = None
                    elif author_email not in authors:
                        author_data = {"name": data.get("author_name")}
                        author, created = CommitAuthor.objects.get_or_create(
                            organization_id=self.organization_id,
                            email=author_email,
                            defaults=author_data,
                        )
                        if author.name != author_data["name"]:
                            author.update(name=author_data["name"])
                        authors[author_email] = author
                    else:
                        author = authors[author_email]

                    commit_data = {}

                    # Update/set message and author if they are provided.
                    if author is not None:
                        commit_data["author"] = author
                    if "message" in data:
                        commit_data["message"] = data["message"]
                    if "timestamp" in data:
                        commit_data["date_added"] = data["timestamp"]

                    commit, created = Commit.objects.get_or_create(
                        organization_id=self.organization_id,
                        repository_id=repo.id,
                        key=data["id"],
                        defaults=commit_data,
                    )
                    if not created:
                        commit_data = {
                            key: value
                            for key, value in six.iteritems(commit_data)
                            if getattr(commit, key) != value
                        }
                        if commit_data:
                            commit.update(**commit_data)

                    if author is None:
                        author = commit.author

                    commit_author_by_commit[commit.id] = author

                    # Guard against patch_set being None
                    patch_set = data.get("patch_set") or []
                    for patched_file in patch_set:
                        try:
                            with transaction.atomic():
                                CommitFileChange.objects.create(
                                    organization_id=self.organization.id,
                                    commit=commit,
                                    filename=patched_file["path"],
                                    type=patched_file["type"],
                                )
                        except IntegrityError:
                            pass

                    try:
                        with transaction.atomic():
                            ReleaseCommit.objects.create(
                                organization_id=self.organization_id,
                                release=self,
                                commit=commit,
                                order=idx,
                            )
                    except IntegrityError:
                        pass

                    if latest_commit is None:
                        latest_commit = commit

                    head_commit_by_repo.setdefault(repo.id, commit.id)

                self.update(
                    commit_count=len(commit_list),
                    authors=[
                        six.text_type(a_id)
                        for a_id in ReleaseCommit.objects.filter(
                            release=self, commit__author_id__isnull=False
                        )
                        .values_list("commit__author_id", flat=True)
                        .distinct()
                    ],
                    last_commit_id=latest_commit.id if latest_commit else None,
                )
                metrics.timing("release.set_commits.duration", time() - start)

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

        release_commits = list(
            ReleaseCommit.objects.filter(release=self)
            .select_related("commit")
            .values("commit_id", "commit__key")
        )

        commit_resolutions = list(
            GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.commit,
                linked_id__in=[rc["commit_id"] for rc in release_commits],
            ).values_list("group_id", "linked_id")
        )

        commit_group_authors = [
            (cr[0], commit_author_by_commit.get(cr[1])) for cr in commit_resolutions  # group_id
        ]

        pr_ids_by_merge_commit = list(
            PullRequest.objects.filter(
                merge_commit_sha__in=[rc["commit__key"] for rc in release_commits],
                organization_id=self.organization_id,
            ).values_list("id", flat=True)
        )

        pull_request_resolutions = list(
            GroupLink.objects.filter(
                relationship=GroupLink.Relationship.resolves,
                linked_type=GroupLink.LinkedType.pull_request,
                linked_id__in=pr_ids_by_merge_commit,
            ).values_list("group_id", "linked_id")
        )

        pr_authors = list(
            PullRequest.objects.filter(
                id__in=[prr[1] for prr in pull_request_resolutions]
            ).select_related("author")
        )

        pr_authors_dict = {pra.id: pra.author for pra in pr_authors}

        pull_request_group_authors = [
            (prr[0], pr_authors_dict.get(prr[1])) for prr in pull_request_resolutions
        ]

        user_by_author = {None: None}

        commits_and_prs = list(itertools.chain(commit_group_authors, pull_request_group_authors))

        group_project_lookup = dict(
            Group.objects.filter(id__in=[group_id for group_id, _ in commits_and_prs]).values_list(
                "id", "project_id"
            )
        )

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
                        "release": self,
                        "type": GroupResolution.Type.in_release,
                        "status": GroupResolution.Status.resolved,
                        "actor_id": actor.id if actor else None,
                    },
                )
                group = Group.objects.get(id=group_id)
                group.update(status=GroupStatus.RESOLVED)
                remove_group_from_inbox(group)
                metrics.incr("group.resolved", instance="in_commit", skip_internal=True)

            issue_resolved.send_robust(
                organization_id=self.organization_id,
                user=actor,
                group=group,
                project=group.project,
                resolution_type="with_commit",
                sender=type(self),
            )

            kick_off_status_syncs.apply_async(
                kwargs={"project_id": group_project_lookup[group_id], "group_id": group_id}
            )

    def safe_delete(self):
        """Deletes a release if possible or raises a `UnsafeReleaseDeletion`
        exception.
        """
        from sentry.models import Group, ReleaseFile
        from sentry.snuba.sessions import check_has_health_data

        # we don't want to remove the first_release metadata on the Group, and
        # while people might want to kill a release (maybe to remove files),
        # removing the release is prevented
        if Group.objects.filter(first_release=self).exists():
            raise UnsafeReleaseDeletion(ERR_RELEASE_REFERENCED)

        # We do not allow releases with health data to be deleted because
        # the upserting from snuba data would create the release again.
        # We would need to be able to delete this data from snuba which we
        # can't do yet.
        project_ids = list(self.projects.values_list("id").all())
        if check_has_health_data([(p[0], self.version) for p in project_ids]):
            raise UnsafeReleaseDeletion(ERR_RELEASE_HEALTH_DATA)

        # TODO(dcramer): this needs to happen in the queue as it could be a long
        # and expensive operation
        file_list = ReleaseFile.objects.filter(release=self).select_related("file")
        for releasefile in file_list:
            releasefile.file.delete()
            releasefile.delete()
        self.delete()

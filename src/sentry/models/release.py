import itertools
import logging
import re
from dataclasses import dataclass
from time import time
from typing import List, Mapping, Optional, Sequence, Union

import sentry_sdk
from django.db import IntegrityError, models, router
from django.db.models import Case, F, Func, Q, Subquery, Sum, Value, When
from django.db.models.signals import pre_save
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.translation import ugettext_lazy as _
from sentry_relay import RelayError, parse_release

from sentry.app import locks
from sentry.constants import BAD_RELEASE_CHARS, COMMIT_RANGE_DELIMITER, SEMVER_FAKE_PACKAGE
from sentry.db.models import (
    ArrayField,
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    sane_repr,
)
from sentry.exceptions import InvalidSearchQuery
from sentry.models import (
    Activity,
    BaseManager,
    CommitFileChange,
    GroupInbox,
    GroupInboxRemoveAction,
    remove_group_from_inbox,
)
from sentry.signals import issue_resolved
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.db import atomic_transaction
from sentry.utils.hashlib import hash_values, md5_text
from sentry.utils.numbers import validate_bigint
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
    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project")
    release = FlexibleForeignKey("sentry.Release")
    new_groups = BoundedPositiveIntegerField(null=True, default=0)

    adopted = models.DateTimeField(null=True, blank=True)
    unadopted = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_release_project"
        index_together = (
            ("project", "adopted"),
            ("project", "unadopted"),
        )
        unique_together = (("project", "release"),)


class ReleaseStatus:
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


@dataclass
class SemverFilter:
    operator: str
    version_parts: Sequence[Union[int, str]]
    package: Optional[str] = None
    negated: bool = False


class ReleaseQuerySet(models.QuerySet):
    def annotate_prerelease_column(self):
        """
        Adds a `prerelease_case` column to the queryset which is used to properly sort
        by prerelease. We treat an empty (but not null) prerelease as higher than any
        other value.
        """
        return self.annotate(
            prerelease_case=Case(
                When(prerelease="", then=1), default=0, output_field=models.IntegerField()
            )
        )

    def filter_to_semver(self):
        """
        Filters the queryset to only include semver compatible rows
        """
        return self.filter(major__isnull=False)

    def filter_by_semver_build(
        self,
        organization_id: int,
        operator: str,
        build: str,
        project_ids: Optional[Sequence[int]] = None,
        negated: bool = False,
    ) -> models.QuerySet:
        """
        Filters released by build. If the passed `build` is a numeric string, we'll filter on
        `build_number` and make use of the passed operator.
        If it is a non-numeric string, then we'll filter on `build_code` instead. We support a
        wildcard only at the end of this string, so that we can filter efficiently via the index.
        """
        qs = self.filter(organization_id=organization_id)
        query_func = "exclude" if negated else "filter"

        if project_ids:
            qs = qs.filter(
                id__in=ReleaseProject.objects.filter(project_id__in=project_ids).values_list(
                    "release_id", flat=True
                )
            )

        if build.isnumeric() and validate_bigint(int(build)):
            qs = getattr(qs, query_func)(**{f"build_number__{operator}": int(build)})
        else:
            if not build or build.endswith("*"):
                qs = getattr(qs, query_func)(build_code__startswith=build[:-1])
            else:
                qs = getattr(qs, query_func)(build_code=build)

        return qs

    def filter_by_semver(
        self,
        organization_id: int,
        semver_filter: SemverFilter,
        project_ids: Optional[Sequence[int]] = None,
    ) -> models.QuerySet:
        """
        Filters releases based on a based `SemverFilter` instance.
        `SemverFilter.version_parts` can contain up to 6 components, which should map
        to the columns defined in `Release.SEMVER_COLS`. If fewer components are
        included, then we will exclude later columns from the filter.
        `SemverFilter.package` is optional, and if included we will filter the `package`
        column using the provided value.
        `SemverFilter.operator` should be a Django field filter.

        Typically we build a `SemverFilter` via `sentry.search.events.filter.parse_semver`
        """
        qs = self.filter(organization_id=organization_id).annotate_prerelease_column()
        query_func = "exclude" if semver_filter.negated else "filter"

        if semver_filter.package:
            qs = getattr(qs, query_func)(package=semver_filter.package)
        if project_ids:
            qs = qs.filter(
                id__in=ReleaseProject.objects.filter(project_id__in=project_ids).values_list(
                    "release_id", flat=True
                )
            )

        if semver_filter.version_parts:
            filter_func = Func(
                *(
                    Value(part) if isinstance(part, str) else part
                    for part in semver_filter.version_parts
                ),
                function="ROW",
            )
            cols = self.model.SEMVER_COLS[: len(semver_filter.version_parts)]
            qs = qs.annotate(
                semver=Func(*(F(col) for col in cols), function="ROW", output_field=ArrayField())
            )
            qs = getattr(qs, query_func)(**{f"semver__{semver_filter.operator}": filter_func})
        return qs

    def filter_by_stage(
        self,
        organization_id: int,
        operator: str,
        value,
        project_ids: Sequence[int] = None,
        environments: List[str] = None,
    ) -> models.QuerySet:
        from sentry.models import ReleaseProjectEnvironment, ReleaseStages
        from sentry.search.events.filter import to_list

        if not environments or len(environments) != 1:
            raise InvalidSearchQuery("Choose a single environment to filter by release stage.")

        filters = {
            ReleaseStages.ADOPTED: Q(adopted__isnull=False, unadopted__isnull=True),
            ReleaseStages.REPLACED: Q(adopted__isnull=False, unadopted__isnull=False),
            ReleaseStages.LOW_ADOPTION: Q(adopted__isnull=True, unadopted__isnull=True),
        }
        value = to_list(value)
        operator_conversions = {"=": "IN", "!=": "NOT IN"}
        if operator in operator_conversions.keys():
            operator = operator_conversions.get(operator)

        for stage in value:
            if stage not in filters:
                raise InvalidSearchQuery("Unsupported release.stage value.")

        rpes = ReleaseProjectEnvironment.objects.filter(
            release__organization_id=organization_id,
        ).select_related("release")

        if project_ids:
            rpes = rpes.filter(project_id__in=project_ids)

        query = Q()
        if operator == "IN":
            for stage in value:
                query |= filters[stage]
        elif operator == "NOT IN":
            for stage in value:
                query &= ~filters[stage]

        qs = self.filter(id__in=Subquery(rpes.filter(query).values_list("release_id", flat=True)))
        return qs

    def order_by_recent(self):
        return self.order_by("-date_added", "-id")

    @staticmethod
    def massage_semver_cols_into_release_object_data(kwargs):
        """
        Helper function that takes kwargs as an argument and massages into it the release semver
        columns (if possible)
        Inputs:
            * kwargs: data of the release that is about to be created
        """
        if "version" in kwargs:
            try:
                version_info = parse_release(kwargs["version"])
                package = version_info.get("package")
                version_parsed = version_info.get("version_parsed")

                if version_parsed is not None and all(
                    validate_bigint(version_parsed[field])
                    for field in ("major", "minor", "patch", "revision")
                ):
                    build_code = version_parsed.get("build_code")
                    build_number = ReleaseQuerySet._convert_build_code_to_build_number(build_code)

                    kwargs.update(
                        {
                            "major": version_parsed.get("major"),
                            "minor": version_parsed.get("minor"),
                            "patch": version_parsed.get("patch"),
                            "revision": version_parsed.get("revision"),
                            "prerelease": version_parsed.get("pre") or "",
                            "build_code": build_code,
                            "build_number": build_number,
                            "package": package,
                        }
                    )
            except RelayError:
                # This can happen on invalid legacy releases
                pass

    @staticmethod
    def _convert_build_code_to_build_number(build_code):
        """
        Helper function that takes the build_code and checks if that build code can be parsed into
        a 64 bit integer
        Inputs:
            * build_code: str
        Returns:
            * build_number
        """
        build_number = None
        if build_code is not None:
            try:
                build_code_as_int = int(build_code)
                if validate_bigint(build_code_as_int):
                    build_number = build_code_as_int
            except ValueError:
                pass
        return build_number


class ReleaseModelManager(BaseManager):
    def get_queryset(self):
        return ReleaseQuerySet(self.model, using=self._db)

    def annotate_prerelease_column(self):
        return self.get_queryset().annotate_prerelease_column()

    def filter_to_semver(self):
        return self.get_queryset().filter_to_semver()

    def filter_by_semver_build(
        self,
        organization_id: int,
        operator: str,
        build: str,
        project_ids: Optional[Sequence[int]] = None,
        negated: bool = False,
    ) -> models.QuerySet:
        return self.get_queryset().filter_by_semver_build(
            organization_id,
            operator,
            build,
            project_ids,
            negated=negated,
        )

    def filter_by_semver(
        self,
        organization_id: int,
        semver_filter: SemverFilter,
        project_ids: Optional[Sequence[int]] = None,
    ) -> models.QuerySet:
        return self.get_queryset().filter_by_semver(organization_id, semver_filter, project_ids)

    def filter_by_stage(
        self,
        organization_id: int,
        operator: str,
        value,
        project_ids: Sequence[int] = None,
        environments: Optional[List[str]] = None,
    ) -> models.QuerySet:
        return self.get_queryset().filter_by_stage(
            organization_id, operator, value, project_ids, environments
        )

    def order_by_recent(self):
        return self.get_queryset().order_by_recent()


class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.

    A commit is generally a git commit. See also releasecommit.py
    """

    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    projects = models.ManyToManyField(
        "sentry.Project", related_name="releases", through=ReleaseProject
    )
    status = BoundedPositiveIntegerField(
        default=ReleaseStatus.OPEN,
        null=True,
        choices=(
            (ReleaseStatus.OPEN, _("Open")),
            (ReleaseStatus.ARCHIVED, _("Archived")),
        ),
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
    last_commit_id = BoundedBigIntegerField(null=True)
    authors = ArrayField(null=True)
    total_deploys = BoundedPositiveIntegerField(null=True, default=0)
    last_deploy_id = BoundedPositiveIntegerField(null=True)

    # Denormalized semver columns. These will be filled if `version` matches at least
    # part of our more permissive model of semver:
    # `<package>@<major>.<minor>.<patch>.<revision>-<prerelease>+<build_code>
    package = models.TextField(null=True)
    major = models.BigIntegerField(null=True)
    minor = models.BigIntegerField(null=True)
    patch = models.BigIntegerField(null=True)
    revision = models.BigIntegerField(null=True)
    prerelease = models.TextField(null=True)
    build_code = models.TextField(null=True)
    # If `build_code` can be parsed as a 64 bit int we'll store it here as well for
    # sorting/comparison purposes
    build_number = models.BigIntegerField(null=True)

    # HACK HACK HACK
    # As a transitional step we permit release rows to exist multiple times
    # where they are "specialized" for a specific project.  The goal is to
    # later split up releases by project again.  This is for instance used
    # by the org release listing.
    _for_project_id = None

    # Custom Model Manager required to override create method
    objects = ReleaseModelManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_release"
        unique_together = (("organization", "version"),)
        # TODO(django2.2): Note that we create this index with each column ordered
        # descending. Django 2.2 allows us to specify functional indexes, which should
        # allow us to specify this on the model.
        # We also use a functional index to order `prerelease` according to semver rules,
        # which we can't express here for now.
        index_together = (
            ("organization", "package", "major", "minor", "patch", "revision", "prerelease"),
            ("organization", "major", "minor", "patch", "revision", "prerelease"),
            ("organization", "build_code"),
            ("organization", "build_number"),
            ("organization", "date_added"),
            ("organization", "status"),
        )

    __repr__ = sane_repr("organization_id", "version")

    SEMVER_COLS = ["major", "minor", "patch", "revision", "prerelease_case", "prerelease"]

    def __eq__(self, other):
        """Make sure that specialized releases are only comparable to the same
        other specialized release.  This for instance lets us treat them
        separately for serialization purposes.
        """
        return Model.__eq__(self, other) and self._for_project_id == other._for_project_id

    def __hash__(self):
        # https://code.djangoproject.com/ticket/30333
        return super().__hash__()

    @staticmethod
    def is_valid_version(value):
        return not (
            not value
            or any(c in value for c in BAD_RELEASE_CHARS)
            or value in (".", "..")
            or value.lower() == "latest"
        )

    @property
    def is_semver_release(self):
        return self.package is not None

    @staticmethod
    def is_semver_version(version):
        """
        Method that checks if a version follows semantic versioning
        """
        if not Release.is_valid_version(version):
            return False

        # Release name has to contain package_name to be parsed correctly by parse_release
        version = version if "@" in version else f"{SEMVER_FAKE_PACKAGE}@{version}"
        try:
            version_info = parse_release(version)
            version_parsed = version_info.get("version_parsed")
            return version_parsed is not None and all(
                validate_bigint(version_parsed[field])
                for field in ("major", "minor", "patch", "revision")
            )
        except RelayError:
            # This can happen on invalid legacy releases
            return False

    @classmethod
    def get_cache_key(cls, organization_id, version):
        return f"release:3:{organization_id}:{md5_text(version).hexdigest()}"

    @classmethod
    def get_lock_key(cls, organization_id, release_id):
        return f"releasecommits:{organization_id}:{release_id}"

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
            project_version = (f"{project.slug}-{version}")[:DB_VERSION_LENGTH]
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
                    with atomic_transaction(using=router.db_for_write(cls)):
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
            Group,
            GroupRelease,
            GroupResolution,
            ReleaseCommit,
            ReleaseEnvironment,
            ReleaseFile,
            ReleaseProject,
            ReleaseProjectEnvironment,
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
                    with atomic_transaction(using=router.db_for_write(model)):
                        model.objects.filter(release_id=release.id).update(**update_kwargs)
                except IntegrityError:
                    for item in model.objects.filter(release_id=release.id):
                        try:
                            with atomic_transaction(using=router.db_for_write(model)):
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

    def add_project(self, project):
        """
        Add a project to this release.

        Returns True if the project was added and did not already exist.
        """
        from sentry.models import Project

        try:
            with atomic_transaction(using=router.db_for_write(ReleaseProject)):
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
                raise InvalidRepository(f"Invalid repository names: {','.join(invalid_repos)}")

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
            PullRequest,
            ReleaseCommit,
            ReleaseHeadCommit,
            Repository,
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
            with atomic_transaction(
                using=(
                    router.db_for_write(type(self)),
                    router.db_for_write(ReleaseCommit),
                    router.db_for_write(Repository),
                    router.db_for_write(CommitAuthor),
                    router.db_for_write(Commit),
                )
            ):
                # TODO(dcramer): would be good to optimize the logic to avoid these
                # deletes but not overly important
                ReleaseCommit.objects.filter(release=self).delete()

                authors = {}
                repos = {}
                commit_author_by_commit = {}
                head_commit_by_repo = {}
                latest_commit = None
                for idx, data in enumerate(commit_list):
                    repo_name = data.get("repository") or f"organization-{self.organization_id}"
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
                            for key, value in commit_data.items()
                            if getattr(commit, key) != value
                        }
                        if commit_data:
                            commit.update(**commit_data)

                    if author is None:
                        author = commit.author

                    commit_author_by_commit[commit.id] = author

                    # Guard against patch_set being None
                    patch_set = data.get("patch_set") or []
                    if patch_set:
                        CommitFileChange.objects.bulk_create(
                            [
                                CommitFileChange(
                                    organization_id=self.organization.id,
                                    commit=commit,
                                    filename=patched_file["path"],
                                    type=patched_file["type"],
                                )
                                for patched_file in patch_set
                            ],
                            ignore_conflicts=True,
                        )

                    try:
                        with atomic_transaction(using=router.db_for_write(ReleaseCommit)):
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
                        str(a_id)
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
        for repo_id, commit_id in head_commit_by_repo.items():
            try:
                with atomic_transaction(using=router.db_for_write(ReleaseHeadCommit)):
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

            with atomic_transaction(
                using=(
                    router.db_for_write(GroupResolution),
                    router.db_for_write(Group),
                    # inside the remove_group_from_inbox
                    router.db_for_write(GroupInbox),
                    router.db_for_write(Activity),
                )
            ):
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
                remove_group_from_inbox(group, action=GroupInboxRemoveAction.RESOLVED, user=actor)
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
        from sentry import release_health
        from sentry.models import Group, ReleaseFile

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
        if release_health.check_has_health_data([(p[0], self.version) for p in project_ids]):
            raise UnsafeReleaseDeletion(ERR_RELEASE_HEALTH_DATA)

        # TODO(dcramer): this needs to happen in the queue as it could be a long
        # and expensive operation
        file_list = ReleaseFile.objects.filter(release_id=self.id).select_related("file")
        for releasefile in file_list:
            releasefile.file.delete()
            releasefile.delete()
        self.delete()

    def count_artifacts(self):
        """Sum the artifact_counts of all release files.

        An artifact count of NULL is interpreted as 1.
        """
        counts = get_artifact_counts([self.id])
        return counts.get(self.id, 0)

    def clear_commits(self):
        """
        Delete all release-specific commit data associated to this release. We will not delete the Commit model values because other releases may use these commits.
        """
        with sentry_sdk.start_span(op="clear_commits"):
            from sentry.models import ReleaseCommit, ReleaseHeadCommit

            ReleaseHeadCommit.objects.get(
                organization_id=self.organization_id, release=self
            ).delete()
            ReleaseCommit.objects.filter(
                organization_id=self.organization_id, release=self
            ).delete()

            self.authors = []
            self.commit_count = 0
            self.last_commit_id = None
            self.save()


def get_artifact_counts(release_ids: List[int]) -> Mapping[int, int]:
    """Get artifact count grouped by IDs"""
    from sentry.models.releasefile import ReleaseFile

    qs = (
        ReleaseFile.objects.filter(release_id__in=release_ids)
        .annotate(count=Sum(Func(F("artifact_count"), 1, function="COALESCE")))
        .values_list("release_id", "count")
    )
    qs.query.group_by = ["release_id"]
    return dict(qs)


def follows_semver_versioning_scheme(org_id, project_id, release_version=None):
    """
    Checks if we should follow semantic versioning scheme for ordering based on
    1. Latest ten releases of the project_id passed in all follow semver
    2. provided release version argument is a valid semver version

    Inputs:
        * org_id
        * project_id
        * release_version
    Returns:
        Boolean that indicates if we should follow semantic version or not
    """
    # ToDo(ahmed): Move this function else where to be easily accessible for re-use
    cache_key = "follows_semver:1:%s" % hash_values([org_id, project_id])
    follows_semver = cache.get(cache_key)

    if follows_semver is None:

        # Check if the latest ten releases are semver compliant
        releases_list = list(
            Release.objects.filter(organization_id=org_id, projects__id__in=[project_id]).order_by(
                "-date_added"
            )[:10]
        )

        if not releases_list:
            cache.set(cache_key, False, 3600)
            return False

        # ToDo(ahmed): re-visit/replace these conditions once we enable project wide `semver` setting
        # A project is said to be following semver versioning schemes if it satisfies the following
        # conditions:-
        # 1: At least one semver compliant in the most recent 3 releases
        # 2: At least 3 semver compliant releases in the most recent 10 releases
        if len(releases_list) <= 2:
            # Most recent release is considered to decide if project follows semver
            follows_semver = releases_list[0].is_semver_release
        elif len(releases_list) < 10:
            # We forego condition 2 and it is enough if condition 1 is satisfied to consider this
            # project to have semver compliant releases
            follows_semver = any(release.is_semver_release for release in releases_list[0:3])
        else:
            # Count number of semver releases in the last ten
            semver_matches = sum(map(lambda release: release.is_semver_release, releases_list))

            at_least_three_in_last_ten = semver_matches >= 3
            at_least_one_in_last_three = any(
                release.is_semver_release for release in releases_list[0:3]
            )

            follows_semver = at_least_one_in_last_three and at_least_three_in_last_ten
        cache.set(cache_key, follows_semver, 3600)

    # Check release_version that is passed is semver compliant
    if release_version:
        follows_semver = follows_semver and Release.is_semver_version(release_version)
    return follows_semver


def parse_semver_pre_save(instance, **kwargs):
    if instance.id:
        return
    ReleaseQuerySet.massage_semver_cols_into_release_object_data(instance.__dict__)


pre_save.connect(
    parse_semver_pre_save, sender="sentry.Release", dispatch_uid="parse_semver_pre_save"
)

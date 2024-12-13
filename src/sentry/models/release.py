# Sort commit list in reverse order
from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import ClassVar, Literal, TypedDict

import orjson
import sentry_sdk
from django.db import IntegrityError, models, router
from django.db.models import Case, F, Func, Sum, When
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _
from sentry_relay.exceptions import RelayError
from sentry_relay.processing import parse_release

from sentry.backup.scopes import RelocationScope
from sentry.constants import BAD_RELEASE_CHARS, COMMIT_RANGE_DELIMITER
from sentry.db.models import (
    ArrayField,
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.indexes import IndexWithPostgresNameLimits
from sentry.db.models.manager.base import BaseManager
from sentry.models.artifactbundle import ArtifactBundle
from sentry.models.commitauthor import CommitAuthor
from sentry.models.releases.constants import (
    DB_VERSION_LENGTH,
    ERR_RELEASE_HEALTH_DATA,
    ERR_RELEASE_REFERENCED,
)
from sentry.models.releases.exceptions import UnsafeReleaseDeletion
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.releases.util import ReleaseQuerySet, SemverFilter, SemverVersion
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.db import atomic_transaction
from sentry.utils.hashlib import hash_values, md5_text
from sentry.utils.numbers import validate_bigint

logger = logging.getLogger(__name__)


class _CommitDataKwargs(TypedDict, total=False):
    author: CommitAuthor
    message: str
    date_added: str


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


def _get_cache_key(project_id: int, group_id: int, first: bool) -> str:
    return f"g-r:{group_id}-{project_id}-{first}"


class ReleaseModelManager(BaseManager["Release"]):
    def get_queryset(self) -> ReleaseQuerySet:
        return ReleaseQuerySet(self.model, using=self._db)

    def annotate_prerelease_column(self):
        return self.get_queryset().annotate_prerelease_column()

    def filter_to_semver(self) -> ReleaseQuerySet:
        return self.get_queryset().filter_to_semver()

    def filter_by_semver_build(
        self,
        organization_id: int,
        operator: str,
        build: str,
        project_ids: Sequence[int] | None = None,
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
        project_ids: Sequence[int] | None = None,
    ) -> models.QuerySet:
        return self.get_queryset().filter_by_semver(organization_id, semver_filter, project_ids)

    def filter_by_stage(
        self,
        organization_id: int,
        operator: str,
        value,
        project_ids: Sequence[int] | None = None,
        environments: list[str] | None = None,
    ) -> models.QuerySet:
        return self.get_queryset().filter_by_stage(
            organization_id, operator, value, project_ids, environments
        )

    def order_by_recent(self):
        return self.get_queryset().order_by_recent()

    def _get_group_release_version(self, group_id: int, orderby: str) -> str:
        from sentry.models.grouprelease import GroupRelease

        # Using `id__in()` because there is no foreign key relationship.
        return self.get(
            id__in=GroupRelease.objects.filter(group_id=group_id)
            .order_by(orderby)
            .values("release_id")[:1]
        ).version

    def get_group_release_version(
        self, project_id: int, group_id: int, first: bool = True, use_cache: bool = True
    ) -> str | None:
        cache_key = _get_cache_key(project_id, group_id, first)

        release_version: Literal[False] | str | None = cache.get(cache_key) if use_cache else None
        if release_version is False:
            # We've cached the fact that no rows exist.
            return None

        if release_version is None:
            # Cache miss or not use_cache.
            orderby = "first_seen" if first else "-last_seen"
            try:
                release_version = self._get_group_release_version(group_id, orderby)
            except Release.DoesNotExist:
                release_version = False
            cache.set(cache_key, release_version, 3600)

        # Convert the False back into a None.
        return release_version or None


@region_silo_model
class Release(Model):
    """
    A release is generally created when a new version is pushed into a
    production state.

    A commit is generally a git commit. See also releasecommit.py
    """

    __relocation_scope__ = RelocationScope.Excluded

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
    # Deprecated, in favor of ReleaseProject new_groups field
    new_groups = BoundedPositiveIntegerField(default=0)
    # generally the release manager, or the person initiating the process
    owner_id = HybridCloudForeignKey("sentry.User", on_delete="SET_NULL", null=True, blank=True)

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
    _for_project_id: int | None = None
    # the user agent that set the release
    user_agent = models.TextField(null=True)

    # Custom Model Manager required to override create method
    objects: ClassVar[ReleaseModelManager] = ReleaseModelManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_release"
        unique_together = (("organization", "version"),)
        indexes = [
            models.Index(
                fields=["organization", "version"],
                opclasses=["", "text_pattern_ops"],
                name="sentry_release_version_btree",
            ),
            # We also use a functional index to order `prerelease` according to semver rules,
            IndexWithPostgresNameLimits(
                "organization",
                "package",
                F("major").desc(),
                F("minor").desc(),
                F("patch").desc(),
                F("revision").desc(),
                Case(When(prerelease="", then=1), default=0).desc(),
                F("prerelease").desc(),
                name="sentry_release_semver_by_package_idx",
            ),
            models.Index(
                "organization",
                F("major").desc(),
                F("minor").desc(),
                F("patch").desc(),
                F("revision").desc(),
                Case(When(prerelease="", then=1), default=0).desc(),
                F("prerelease").desc(),
                name="sentry_release_semver_idx",
            ),
            models.Index(fields=("organization", "build_code")),
            models.Index(fields=("organization", "build_number")),
            models.Index(fields=("organization", "date_added")),
            models.Index(fields=("organization", "status")),
        ]

    __repr__ = sane_repr("organization_id", "version")

    SEMVER_COLS = ["major", "minor", "patch", "revision", "prerelease_case", "prerelease"]

    def __eq__(self, other: object) -> bool:
        """Make sure that specialized releases are only comparable to the same
        other specialized release.  This for instance lets us treat them
        separately for serialization purposes.
        """
        return (
            # don't treat `NotImplemented` as truthy
            Model.__eq__(self, other) is True
            and isinstance(other, Release)
            and self._for_project_id == other._for_project_id
        )

    def __hash__(self):
        # https://code.djangoproject.com/ticket/30333
        return super().__hash__()

    @staticmethod
    def is_valid_version(value):
        if value is None:
            return False

        if any(c in value for c in BAD_RELEASE_CHARS):
            return False

        value_stripped = str(value).strip()
        return not (
            not value_stripped
            or value_stripped in (".", "..")
            or value_stripped.lower() == "latest"
        )

    @property
    def is_semver_release(self):
        return self.package is not None

    def get_previous_release(self, project):
        """Get the release prior to this one. None if none exists"""
        return (
            ReleaseProject.objects.filter(project=project, release__date_added__lt=self.date_added)
            .order_by("-release__date_added")
            .first()
        )

    @staticmethod
    def is_semver_version(version):
        """
        Method that checks if a version follows semantic versioning
        """
        # If version is not a valid release version, or it has no package then we return False
        if not Release.is_valid_version(version) or "@" not in version:
            return False

        try:
            version_info = parse_release(version, json_loads=orjson.loads)
            version_parsed = version_info.get("version_parsed")
            return version_parsed is not None and all(
                validate_bigint(version_parsed[field])
                for field in ("major", "minor", "patch", "revision")
            )
        except RelayError:
            # This can happen on invalid legacy releases
            return False

    @staticmethod
    def is_release_newer_or_equal(org_id, release, other_release):
        if release is None:
            return False

        if other_release is None:
            return True

        if release == other_release:
            return True

        releases = {
            release.version: float(release.date_added.timestamp())
            for release in Release.objects.filter(
                organization_id=org_id, version__in=[release, other_release]
            )
        }
        release_date = releases.get(release)
        other_release_date = releases.get(other_release)

        if release_date is not None and other_release_date is not None:
            return release_date > other_release_date

        return False

    @property
    def semver_tuple(self) -> SemverVersion:
        return SemverVersion(
            self.major,
            self.minor,
            self.patch,
            self.revision,
            1 if self.prerelease == "" else 0,
            self.prerelease,
        )

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
        from sentry.models.project import Project

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

                # NOTE: `add_project` creates a ReleaseProject instance
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
            return parse_release(self.version, json_loads=orjson.loads)
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

        from sentry.models.group import Group
        from sentry.models.grouprelease import GroupRelease
        from sentry.models.groupresolution import GroupResolution
        from sentry.models.releasecommit import ReleaseCommit
        from sentry.models.releaseenvironment import ReleaseEnvironment
        from sentry.models.releasefile import ReleaseFile
        from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
        from sentry.models.releases.release_project import ReleaseProject

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
        from sentry.models.distribution import Distribution

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
        from sentry.models.project import Project

        try:
            with atomic_transaction(using=router.db_for_write(ReleaseProject)):
                obj, created = ReleaseProject.objects.get_or_create(project=project, release=self)
                if not project.flags.has_releases:
                    project.flags.has_releases = True
                    project.update(flags=F("flags").bitor(Project.flags.has_releases))
        except IntegrityError:
            obj = None
            created = False

        return obj, created

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

    def set_refs(self, refs, user_id, fetch=False):
        with sentry_sdk.start_span(op="set_refs"):
            from sentry.api.exceptions import InvalidRepository
            from sentry.models.commit import Commit
            from sentry.models.releaseheadcommit import ReleaseHeadCommit
            from sentry.models.repository import Repository
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
                        "user_id": user_id,
                        "refs": refs,
                        "prev_release_id": prev_release and prev_release.id,
                    }
                )

    @sentry_sdk.trace
    def set_commits(self, commit_list):
        """
        Bind a list of commits to this release.

        This will clear any existing commit log and replace it with the given
        commits.
        """
        sentry_sdk.set_measurement("release.set_commits", len(commit_list))
        from sentry.models.releases.set_commits import set_commits

        set_commits(self, commit_list)

    def safe_delete(self):
        """Deletes a release if possible or raises a `UnsafeReleaseDeletion`
        exception.
        """
        from sentry import release_health
        from sentry.models.group import Group
        from sentry.models.releasefile import ReleaseFile

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
        if release_health.backend.check_has_health_data(
            [(p[0], self.version) for p in project_ids]
        ):
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

    def count_artifacts_in_artifact_bundles(self, project_ids: Sequence[int]):
        """
        Counts the number of artifacts in the artifact bundles associated with this release and a set of projects.
        """
        qs = (
            ArtifactBundle.objects.filter(
                organization_id=self.organization.id,
                releaseartifactbundle__release_name=self.version,
                projectartifactbundle__project_id__in=project_ids,
            )
            .annotate(count=Sum(Func(F("artifact_count"), 1, function="COALESCE")))
            .values_list("releaseartifactbundle__release_name", "count")
        )

        qs.query.group_by = ["releaseartifactbundle__release_name"]

        if len(qs) == 0:
            return None

        return qs[0]

    def clear_commits(self):
        """
        Delete all release-specific commit data associated to this release. We will not delete the Commit model values because other releases may use these commits.
        """
        with sentry_sdk.start_span(op="clear_commits"):
            from sentry.models.releasecommit import ReleaseCommit
            from sentry.models.releaseheadcommit import ReleaseHeadCommit

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


def get_artifact_counts(release_ids: list[int]) -> Mapping[int, int]:
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
    # TODO(ahmed): Move this function else where to be easily accessible for re-use
    # TODO: this method could be moved to the Release model manager
    cache_key = "follows_semver:1:%s" % hash_values([org_id, project_id])
    follows_semver = cache.get(cache_key)

    if follows_semver is None:
        # Check if the latest ten releases are semver compliant
        releases_list = list(
            Release.objects.filter(
                organization_id=org_id, projects__id__in=[project_id], status=ReleaseStatus.OPEN
            )
            .using_replica()
            .order_by("-date_added")[:10]
        )

        if not releases_list:
            cache.set(cache_key, False, 3600)
            return False

        # TODO(ahmed): re-visit/replace these conditions once we enable project wide `semver` setting
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

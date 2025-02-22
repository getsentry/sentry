from __future__ import annotations

import logging
from collections import namedtuple
from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING, Self

from django.db import models
from django.db.models import Case, F, Func, Q, Subquery, Value, When
from django.db.models.signals import pre_save
from sentry_relay.exceptions import RelayError
from sentry_relay.processing import parse_release

from sentry.db.models import ArrayField
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.exceptions import InvalidSearchQuery
from sentry.models.releases.release_project import ReleaseProject
from sentry.utils.numbers import validate_bigint

if TYPE_CHECKING:
    from sentry.models.release import Release  # noqa: F401

logger = logging.getLogger(__name__)


class SemverVersion(
    namedtuple("SemverVersion", "major minor patch revision prerelease_case prerelease")
):
    pass


@dataclass
class SemverFilter:
    operator: str
    version_parts: Sequence[int | str]
    package: str | Sequence[str] | None = None
    negated: bool = False


class ReleaseQuerySet(BaseQuerySet["Release"]):
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

    def filter_to_semver(self) -> Self:
        """
        Filters the queryset to only include semver compatible rows
        """
        return self.filter(major__isnull=False)

    def filter_by_semver_build(
        self,
        organization_id: int,
        operator: str,
        build: str | Sequence[str],
        project_ids: Sequence[int] | None = None,
        negated: bool = False,
    ) -> Self:
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

        # Convert single string to list to simplify logic
        builds = [build] if isinstance(build, str) else build

        build_number_filters = Q()
        build_code_filters = Q()
        for b in builds:
            if b.isdecimal() and validate_bigint(int(b)):
                build_number_filters |= Q(**{f"build_number__{operator}": int(b)})
            else:
                if not b or b.endswith("*"):
                    build_code_filters |= Q(build_code__startswith=b[:-1])
                else:
                    build_code_filters |= Q(build_code=b)

        if build_number_filters:
            qs = getattr(qs, query_func)(build_number_filters)
        if build_code_filters:
            qs = getattr(qs, query_func)(build_code_filters)

        if operator == "in":
            return qs.filter(
                Q(
                    build_number__in=[
                        int(b) for b in builds if b.isdecimal() and validate_bigint(int(b))
                    ]
                )
                | Q(
                    build_code__in=[
                        b for b in builds if not b.isdecimal() or not validate_bigint(int(b))
                    ]
                )
            )
        return qs

    def filter_by_semver(
        self,
        organization_id: int,
        semver_filter: SemverFilter,
        project_ids: Sequence[int] | None = None,
    ) -> Self:
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
            if isinstance(semver_filter.package, str):
                qs = getattr(qs, query_func)(package=semver_filter.package)
            else:
                qs = getattr(qs, query_func)(package__in=semver_filter.package)
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
        project_ids: Sequence[int] | None = None,
        environments: list[str] | None = None,
    ) -> Self:
        from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment, ReleaseStages
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
        operator = operator_conversions.get(operator, operator)

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

    def order_by_recent(self) -> Self:
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


def parse_semver_pre_save(instance, **kwargs):
    if instance.id:
        return
    ReleaseQuerySet.massage_semver_cols_into_release_object_data(instance.__dict__)


pre_save.connect(
    parse_semver_pre_save, sender="sentry.Release", dispatch_uid="parse_semver_pre_save"
)

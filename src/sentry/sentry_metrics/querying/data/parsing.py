import re
from collections.abc import Generator, Sequence

from parsimonious.exceptions import IncompleteParseError
from snuba_sdk import Timeseries
from snuba_sdk.mql.mql import InvalidMQLQueryError, parse_mql

from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.sentry_metrics.querying.errors import InvalidMetricsQueryError
from sentry.sentry_metrics.querying.utils import remove_if_match
from sentry.sentry_metrics.querying.visitors import (
    EnvironmentsInjectionVisitor,
    LatestReleaseTransformationVisitor,
    QueryConditionsCompositeVisitor,
    QueryValidationVisitor,
    VisitableQueryExpression,
)


class QueryParser:
    # We avoid having the filters expression to be closed or opened.
    FILTERS_SANITIZATION_PATTERN = re.compile(r"[{}]$")
    # We avoid to have any way of opening and closing other expressions.
    GROUP_BYS_SANITIZATION_PATTERN = re.compile(r"[(){}\[\]]")

    def __init__(
        self,
        projects: Sequence[Project],
        fields: Sequence[str],
        query: str | None,
        group_bys: Sequence[str] | None,
    ):
        self._projects = projects
        self._fields = fields
        self._query = query
        self._group_bys = group_bys

        # We want to sanitize the input in order to avoid any injection attacks due to the string interpolation that
        # it's performed when building the MQL query.
        self._sanitize()

    def _sanitize(self):
        """
        Sanitizes the query and group bys before using them to build the MQL query.
        """
        if self._query:
            self._query = remove_if_match(self.FILTERS_SANITIZATION_PATTERN, self._query)

        if self._group_bys:
            self._group_bys = [
                remove_if_match(self.GROUP_BYS_SANITIZATION_PATTERN, group_by)
                for group_by in self._group_bys
            ]

    def _build_mql_filters(self) -> str | None:
        """
        Builds a set of MQL filters from a single query string.

        In this case the query passed, is assumed to be already compatible with the filters grammar of MQL, thus no
        transformation are performed.
        """
        if not self._query:
            return None

        return self._query

    def _build_mql_group_bys(self) -> str | None:
        """
        Builds a set of MQL group by filters from a list of strings.
        """
        if not self._group_bys:
            return None

        return ",".join(self._group_bys)

    def _build_mql_query(self, field: str, filters: str | None, group_bys: str | None) -> str:
        """
        Builds an MQL query string in the form `aggregate(metric){tag_key:tag_value} by (group_by_1, group_by_2).
        """
        mql = field

        if filters is not None:
            mql += f"{{{filters}}}"

        if group_bys is not None:
            mql += f" by ({group_bys})"

        return mql

    def _parse_mql(self, mql: str) -> VisitableQueryExpression:
        """
        Parses the field with the MQL grammar.
        """
        try:
            query = parse_mql(mql)
        except InvalidMQLQueryError as e:
            cause = e.__cause__
            if cause and isinstance(cause, IncompleteParseError):
                error_context = cause.text[cause.pos : cause.pos + 20]
                # We expose the entire MQL string to give more context when solving the error, since in the future we
                # expect that MQL will be directly fed into the endpoint instead of being built from the supplied
                # fields.
                raise InvalidMetricsQueryError(
                    f"The query '{mql}' could not be matched starting from '{error_context}...'"
                ) from e

            raise InvalidMetricsQueryError("The supplied query is not valid") from e

        return VisitableQueryExpression(query=query)

    def generate_queries(
        self, environments: Sequence[Environment]
    ) -> Generator[tuple[str, Timeseries], None, None]:
        """
        Generates multiple timeseries queries given a base query.
        """
        if not self._fields:
            raise InvalidMetricsQueryError("You must query at least one field")

        # We first parse the filters and group bys, which are then going to be applied on each individual query
        # that is executed.
        mql_filters = self._build_mql_filters()
        mql_group_bys = self._build_mql_group_bys()

        for field in self._fields:
            mql_query = self._build_mql_query(field, mql_filters, mql_group_bys)
            yield (
                field,
                self._parse_mql(mql_query)
                # We validate the query.
                .add_visitor(QueryValidationVisitor())
                # We inject the environment filter in each timeseries.
                .add_visitor(EnvironmentsInjectionVisitor(environments))
                # We transform all `release:latest` filters into the actual latest releases.
                .add_visitor(
                    QueryConditionsCompositeVisitor(
                        LatestReleaseTransformationVisitor(self._projects)
                    )
                ).get(),
            )

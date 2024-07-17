from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationAndStaffPermission, OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.use_case_utils import get_use_case_id
from sentry.snuba.metrics import DerivedMetricException, QueryDefinition, get_series
from sentry.snuba.metrics.naming_layer import SessionMetricKey
from sentry.snuba.metrics.query_builder import parse_field
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils import metrics
from sentry.utils.cursors import Cursor, CursorResult


@region_silo_endpoint
class OrganizationReleaseHealthDataEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (OrganizationAndStaffPermission,)

    """Get the time series data for one or more metrics.

    The data can be filtered and grouped by tags.
    Based on `OrganizationSessionsEndpoint`.
    """

    # 60 req/s to allow for metric dashboard loading
    default_rate_limit = RateLimit(limit=60, window=1)

    rate_limits = {
        "GET": {
            RateLimitCategory.IP: default_rate_limit,
            RateLimitCategory.USER: default_rate_limit,
            RateLimitCategory.ORGANIZATION: default_rate_limit,
        },
    }

    # Number of groups returned for each page (applies to old endpoint).
    default_per_page = 50

    def _validate_fields(self, request: Request):
        """
        Validates fields request parameter.
        Checks if metric field is public (InvalidParams exception is raised if it is not),
        and checks if every generic metric that is requested has operation assigned, because
        it is not possible to query generic metrics without assigned operation.

        NOTE 'd:sessions/duration.exited@second' is a derived metric but for unknown
        reason entity is not 'e', so we do extra check just for that metric.
        """
        fields = request.GET.getlist("field", [])
        for field in fields:
            try:
                metric_field = parse_field(field, allow_mri=True)
                if (
                    metric_field.op is None
                    and not metric_field.metric_mri.startswith("e:")
                    and metric_field.metric_mri
                    != "d:sessions/duration.exited@second"  # this is special case, derived metric without 'e' as entity
                ):
                    raise ParseError(
                        detail="You can not use generic metric public field without operation"
                    )
            except InvalidParams as exc:
                raise ParseError(detail=str(exc))

    def get(self, request: Request, organization) -> Response:
        projects = self.get_projects(request, organization)
        self._validate_fields(request)

        def data_fn(offset: int, limit: int):
            try:
                query = QueryDefinition(
                    projects,
                    request.GET,
                    allow_mri=True,
                    paginator_kwargs={"limit": limit, "offset": offset},
                )
                data = get_series(
                    projects,
                    metrics_query=query.to_metrics_query(),
                    use_case_id=get_use_case_id(request),
                    tenant_ids={"organization_id": organization.id},
                )
                # due to possible data corruption crash free value can be less than 0 or greater than 1,
                # which is not valid behavior, so those values have to be capped
                metrics.ensure_crash_rate_in_bounds(
                    data, request, organization, SessionMetricKey.CRASH_RATE.value
                )
                metrics.ensure_crash_rate_in_bounds(
                    data, request, organization, SessionMetricKey.CRASH_FREE_RATE.value
                )

                data["query"] = query.query
            except (
                InvalidParams,
                DerivedMetricException,
            ) as exc:
                raise (ParseError(detail=str(exc)))
            return data

        return self.paginate(
            request,
            paginator=MetricsDataSeriesPaginator(data_fn=data_fn),
            default_per_page=self.default_per_page,
            max_per_page=100,
        )


class MetricsDataSeriesPaginator(GenericOffsetPaginator):
    def get_result(self, limit, cursor=None):
        assert limit > 0
        offset = cursor.offset if cursor is not None else 0
        data = self.data_fn(offset=offset, limit=limit + 1)

        if isinstance(data.get("groups"), list):
            has_more = len(data["groups"]) == limit + 1
            if has_more:
                data["groups"].pop()
        else:
            raise NotImplementedError

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )

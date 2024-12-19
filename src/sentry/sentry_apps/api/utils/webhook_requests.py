from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TypedDict

from sentry.models.organizationmapping import OrganizationMapping
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app_request import RpcSentryAppRequest, SentryAppRequestFilterArgs
from sentry.sentry_apps.services.app_request.serial import serialize_rpc_sentry_app_request
from sentry.sentry_apps.services.app_request.service import app_request_service
from sentry.types.region import find_all_region_names
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


@dataclass
class BufferedRequest:
    id: int
    data: RpcSentryAppRequest

    def __hash__(self):
        return self.id


class DatetimeOrganizationFilterArgs(TypedDict):
    start_time: datetime
    end_time: datetime
    organization: OrganizationMapping | None


def _filter_by_date(request: RpcSentryAppRequest, start: datetime, end: datetime) -> bool:
    date_str = request.date
    if not date_str:
        return False
    timestamp = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S.%f+00:00").replace(
        microsecond=0, tzinfo=timezone.utc
    )
    return start <= timestamp <= end


def _filter_by_organization(
    request: RpcSentryAppRequest, organization: OrganizationMapping | None
) -> bool:
    if not organization:
        return True
    return request.organization_id == organization.organization_id


def filter_requests(
    unfiltered_requests: list[RpcSentryAppRequest],
    filter: DatetimeOrganizationFilterArgs,
) -> list[BufferedRequest]:
    requests: list[BufferedRequest] = []
    for i, req in enumerate(unfiltered_requests):
        if _filter_by_date(
            req, filter.get("start_time"), filter.get("end_time")
        ) and _filter_by_organization(req, organization=filter.get("organization")):
            requests.append(BufferedRequest(id=i, data=req))
    return requests


def get_buffer_requests_from_control(
    sentry_app: SentryApp,
    filter: SentryAppRequestFilterArgs,
    datetime_org_filter: DatetimeOrganizationFilterArgs,
) -> list[BufferedRequest]:
    control_buffer = SentryAppWebhookRequestsBuffer(sentry_app)

    event = filter.get("event", None) if filter else None
    errors_only = filter.get("errors_only", False) if filter else False

    unfiltered_requests = [
        serialize_rpc_sentry_app_request(req)
        for req in control_buffer.get_requests(event=event, errors_only=errors_only)
    ]
    return filter_requests(
        unfiltered_requests,
        datetime_org_filter,
    )


def get_buffer_requests_from_regions(
    sentry_app_id: int,
    filter: SentryAppRequestFilterArgs,
    datetime_org_filter: DatetimeOrganizationFilterArgs,
) -> list[BufferedRequest]:
    requests: list[RpcSentryAppRequest] = []
    for region_name in find_all_region_names():
        buffer_requests = app_request_service.get_buffer_requests_for_region(
            sentry_app_id=sentry_app_id,
            region_name=region_name,
            filter=filter,
        )
        if buffer_requests:
            requests.extend(buffer_requests)
    return filter_requests(requests, datetime_org_filter)

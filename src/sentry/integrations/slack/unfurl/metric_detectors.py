from __future__ import annotations

import html
import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlparse

import sentry_sdk
from django.db.models import Q
from django.http.request import HttpRequest, QueryDict

from sentry import features
from sentry.api.serializers import serialize
from sentry.incidents.charts import build_metric_alert_chart
from sentry.incidents.endpoints.serializers.workflow_engine_detector import (
    WorkflowEngineDetectorSerializer,
)
from sentry.incidents.metric_issue_detector import fetch_snuba_query
from sentry.incidents.typings.metric_detector import AlertContext
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.slack.message_builder.metric_alerts import SlackMetricAlertMessageBuilder
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.unfurl.types import (
    Handler,
    UnfurlableUrl,
    UnfurledUrl,
    make_type_coercer,
)
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import Detector

map_detector_args = make_type_coercer(
    {
        "org_slug": str,
        "start": str,
        "end": str,
    }
)


def unfurl_metric_detectors(
    request: HttpRequest,
    integration: Integration | RpcIntegration,
    links: list[UnfurlableUrl],
    user: User | RpcUser | None = None,
) -> UnfurledUrl:
    event = MessagingInteractionEvent(
        MessagingInteractionType.UNFURL_METRIC_DETECTORS, SlackMessagingSpec(), user=user
    )
    with event.capture():
        return _unfurl_metric_detectors(integration, links, user)


def _unfurl_metric_detectors(
    integration: Integration | RpcIntegration,
    links: list[UnfurlableUrl],
    user: User | RpcUser | None = None,
) -> UnfurledUrl:
    detector_filter_query = Q()
    # Since we don't have real ids here, we use the org slug so that we can
    # make sure the identifiers correspond to the correct organization.

    # detector link example https://sentry.sentry.io/issues/monitors/2809020/?end=2025-10-08T14%3A41%3A00&start=2025-10-08T11%3A11%3A00
    for link in links:
        detector_id = link.args.get("detector_id")
        if detector_id:
            detector_filter_query |= Q(id=detector_id)

    org_integrations = integration_service.get_organization_integrations(
        integration_id=integration.id
    )
    organizations = Organization.objects.filter(
        id__in=[oi.organization_id for oi in org_integrations]
    )
    detector_map = {}
    for detector in Detector.objects.filter(detector_filter_query):
        if detector.project.organization in organizations:
            # need to ensure org has access to this detector
            detector_map[detector.id] = detector

    if not detector_map:
        return {}

    orgs_by_slug: dict[str, Organization] = {org.slug: org for org in organizations}

    result = {}
    for link in links:
        if link.args["detector_id"] not in detector_map:
            continue
        org = orgs_by_slug.get(link.args["org_slug"])
        if org is None:
            continue

        detector = detector_map[link.args["detector_id"]]
        snuba_query = fetch_snuba_query(detector)
        if not snuba_query:
            continue

        chart_url = None

        if features.has("organizations:metric-alert-chartcuterie", org):
            try:
                detector_serialized_response = serialize(
                    detector, user, WorkflowEngineDetectorSerializer()
                )
                chart_url = build_metric_alert_chart(  # TODO might make a new function to use rather than reusing this
                    organization=org,
                    alert_rule_serialized_response=detector_serialized_response,
                    snuba_query=snuba_query,
                    alert_context=AlertContext.from_workflow_engine_models(detector),
                    start=link.args["start"],
                    end=link.args["end"],
                    user=user,
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

        # TODO: need to make a new message builder
        result[link.url] = SlackMetricAlertMessageBuilder(
            alert_rule=detector,
            chart_url=chart_url,
        ).build()

    return result


def map_metric_detector_query_args(url: str, args: Mapping[str, str | None]) -> Mapping[str, Any]:
    """Extracts some query parameters"""

    # Slack uses HTML escaped ampersands in its Event Links, when need
    # to be unescaped for QueryDict to split properly.
    url = html.unescape(url)
    parsed_url = urlparse(url)
    params = QueryDict(parsed_url.query)
    start = params.get("start", None)
    end = params.get("end", None)

    data = {**args, "start": start, "end": end}
    return map_detector_args(url, data)


# detector link example https://sentry.sentry.io/issues/monitors/123456/?end=2025-10-08T14%3A41%3A00&start=2025-10-08T11%3A11%3A00

metric_detectors_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/organizations/(?#organization_slug)[^/]+/monitors/(?P<detector_id>\d+)"
)
customer_domain_metric_detectors_link_regex = re.compile(
    r"^https?\://(?#url_prefix)[^/]+/issues/monitors/(?P<detector_id>\d+)"
)

metric_alert_handler = Handler(
    fn=unfurl_metric_detectors,
    matcher=[metric_detectors_link_regex, customer_domain_metric_detectors_link_regex],
    arg_mapper=map_metric_detector_query_args,
)

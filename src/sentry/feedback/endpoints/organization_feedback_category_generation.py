import datetime
import logging
from datetime import timedelta
from typing import TypedDict

import requests
from django.conf import settings
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationUserReportsPermission
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.api.utils import get_date_range_from_stats_period
from sentry.exceptions import InvalidParams
from sentry.feedback.query import (
    query_recent_feedbacks_with_ai_labels,
    query_top_ai_labels_by_feedback_count,
)
from sentry.grouping.utils import hash_from_values
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.types import SnubaParams
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.snuba import issue_platform
from sentry.utils import json
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


# If there are less than this number of feedbacks, we don't have enough context to generate categories
MIN_FEEDBACKS_CONTEXT = 10
# Max number of feedbacks (with their associated labels) to pass as context to the LLM
MAX_FEEDBACKS_CONTEXT = 1000
MAX_FEEDBACKS_CONTEXT_CHARS = 1000000

# One day because ???
CATEGORIES_CACHE_TIMEOUT = 86400


class LabelGroupFeedbacksContext(TypedDict):
    """Corresponds to LabelGroupFeedbacksContext in Seer."""

    feedback: str
    labels: list[str]


class LabelGroupsRequest(TypedDict):
    """Corresponds to GenerateFeedbackLabelGroupsRequest in Seer."""

    organization_id: int
    labels: list[str]
    # Providing the LLM context so it knows what labels are used in the same context and are direct children
    feedbacks_context: list[LabelGroupFeedbacksContext]


@region_silo_endpoint
class OrganizationFeedbackCategoryGenerationEndpoint(
    OrganizationEventsV2EndpointBase
):  # XXX: is this inheritance ok? this is only done since this class has the get_snuba_params method.
    owner = ApiOwner.FEEDBACK
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationUserReportsPermission,)

    def _get_top_10_labels(
        self,
        snuba_params: SnubaParams,
        organization: Organization,
        projects: list[Project],
        start: datetime,
        end: datetime,
    ) -> list[str]:
        # Getting from IssuePlatform seems to work for now, so we'll go with it
        # Get the top 10 labels by feedbacks, filtered by projects and date range
        top_10_labels = query_top_ai_labels_by_feedback_count(
            organization_id=organization.id,
            project_ids=[project.id for project in projects],
            start=start,
            end=end,
            count=10,
        )["data"]

        top_10_labels

        # print("\n\n\n\nQ1 RESULTS", top_10_labels, "\n\n\n\n")

        # Query for top tag values across all AI label keys with prefix matching
        # This seems to work, but to be very honest I don't know how it does
        # (nvm, https://github.com/getsentry/snuba/blob/7abc44933b261854a32afeeee3e1c3e033ea2bfb/snuba/query/parser/README.md?plain=1#L240 mentions the tags_key and tags_value virtual columns that are basically an ArrayJoin)
        # Not filtered to only get feedbacks - how to do this? Can't seem to do this using only the issue platform dataset, it seems like we require working with events. Also AI labels are only on feedbacks for now, so maybe not an issue for now?
        issue_platform_results = issue_platform.query(
            selected_columns=["count()", "tags_value"],
            query="tags_key:ai_categorization.label.*",  # Prefix pattern for all AI labels
            snuba_params=snuba_params,
            orderby=["-count()"],
            limit=10,
            referrer="api.organization-issue-replay-count",
        )["data"]

        # print("\n\n\n\nQ2 RESULTS", issue_platform_results, "\n\n\n\n")

        # This works. but we can switch to using the custom Snuba query if we don't want to do this.
        labels = [result["tags_value"] for result in issue_platform_results]

        return labels

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Gets 3-4 categories of feedbacks for an organization.

        Returns 3-4 groups of labels, which correspond to categories, for feedbacks that can be filtered by:
        - A list of projects
        - The date range that they were first seen in (defaults to the last 7 days)

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :qparam int project: project IDs to filter by
        :qparam string statsPeriod: filter feedbacks by date range (e.g. "14d")
        :qparam string start: start date range (alternative to statsPeriod)
        :qparam string end: end date range (alternative to statsPeriod)
        :auth: required
        """

        if not features.has(
            "organizations:user-feedback-ai-categorization", organization, actor=request.user
        ) or not features.has("organizations:gen-ai-features", organization, actor=request.user):
            return Response(status=403)

        try:
            start, end = get_date_range_from_stats_period(
                request.GET,
                optional=False,
                default_stats_period=timedelta(days=7),
            )
        except InvalidParams:
            raise ParseError(detail="Invalid or missing date range")

        projects = self.get_projects(request, organization)

        # Sort first, then convert each element to a string
        numeric_project_ids = sorted([project.id for project in projects])
        project_ids = [str(project_id) for project_id in numeric_project_ids]
        hashed_project_ids = hash_from_values(project_ids)

        # Cache up to the day granularity
        # qq: what happens if a user sets a date range to be within a day? then maybe unexpected results, because say they choose like 18 hours all within a day, then got some categories, then change it to be like 2 hours and would still get the same categories... doesn't make sense
        # let's change this to be the hour granularity or should we do some weird conditional stuff? if it is within a day, then make it up to the hour, but if it is more than a day, then make it up to the day. hmm
        categorization_cache_key = f"feedback_categorization:{organization.id}:{start.strftime('%Y-%m-%d-%H')}:{end.strftime('%Y-%m-%d-%H')}:{hashed_project_ids}"
        categories_cache = cache.get(categorization_cache_key)
        if categories_cache:
            # categories is of the form {primary_label: {"number_of_feedbacks": int, "associated_labels": list[str]}}
            return Response(
                {
                    "categories": categories_cache["categories"],
                    "success": True,
                    "numFeedbacksContext": categories_cache["numFeedbacksContext"],
                }
            )

        recent_feedbacks = query_recent_feedbacks_with_ai_labels(
            organization_id=organization.id,
            project_ids=[project.id for project in projects],
            start=start,
            end=end,
            count=MAX_FEEDBACKS_CONTEXT,
        )["data"]

        if len(recent_feedbacks) < MIN_FEEDBACKS_CONTEXT:
            logger.error("Too few feedbacks to generate categories")
            return Response(
                {
                    "categories": None,
                    "success": False,
                    "numFeedbacksContext": 0,
                }
            )

        context_feedbacks = []
        total_chars = 0
        for feedback in recent_feedbacks:
            total_chars += len(feedback["feedback"])
            total_chars += sum(len(label) for label in feedback["labels"])
            if total_chars > MAX_FEEDBACKS_CONTEXT_CHARS:
                break
            context_feedbacks.append(feedback["feedback"])

        snuba_params = self.get_snuba_params(
            request,
            organization,
            check_global_views=False,
        )

        # Gets the top 10 labels by feedbacks to augment the context that the LLM has, instead of just asking it to generate categories without knowing the most common labels
        top_10_labels = self._get_top_10_labels(snuba_params, organization, projects, start, end)

        seer_request = LabelGroupsRequest(
            organization_id=organization.id,
            labels=top_10_labels,
            feedbacks_context=context_feedbacks,
        )

        try:
            categories = json.loads(make_seer_request(seer_request).decode("utf-8"))
            categories = categories["data"]
        except Exception:
            logger.exception("Error generating categories of user feedbacks")
            return Response({"detail": "Error generating categories"}, status=500)

        cache.set(
            categorization_cache_key,
            {"categories": categories, "numFeedbacksContext": len(context_feedbacks)},
            timeout=CATEGORIES_CACHE_TIMEOUT,
        )

        return Response(
            {
                "categories": categories,
                "success": True,
                "numFeedbacksContext": len(context_feedbacks),
            }
        )


def make_seer_request(request: LabelGroupsRequest) -> bytes:
    serialized_request = json.dumps(request)

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/label-groups",
        data=serialized_request,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(serialized_request.encode()),
        },
    )

    if response.status_code != 200:
        logger.error(
            "Failed to generate label groups",
            extra={
                "status_code": response.status_code,
                "response": response.text,
                "content": response.content,
            },
        )

    response.raise_for_status()

    return response.content

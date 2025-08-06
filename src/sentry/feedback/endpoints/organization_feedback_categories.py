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
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationUserReportsPermission
from sentry.api.utils import get_date_range_from_stats_period
from sentry.exceptions import InvalidParams
from sentry.feedback.lib.label_query import (
    query_label_group_counts,
    query_recent_feedbacks_with_ai_labels,
    query_top_ai_labels_by_feedback_count,
)
from sentry.grouping.utils import hash_from_values
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


# If there are less than this number of feedbacks, we don't have enough context to generate categories
MIN_FEEDBACKS_CONTEXT = 10
# Max number of feedbacks (with their associated labels) to pass as context to the LLM
MAX_FEEDBACKS_CONTEXT = 1000
MAX_FEEDBACKS_CONTEXT_CHARS = 1000000

MAX_RETURN_CATEGORIES = 4

# Two days because the largest granularity we cache at is the day
CATEGORIES_CACHE_TIMEOUT = 172800


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


class FeedbackLabelGroup(TypedDict):
    """Corresponds to FeedbackLabelGroup in Seer."""

    primary_label: str
    associated_labels: list[str]


@region_silo_endpoint
class OrganizationFeedbackCategoriesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FEEDBACK
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationUserReportsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Gets 3-4 categories of feedbacks for an organization.

        Returns 3-4 groups of labels, which correspond to categories, for feedbacks that can be filtered by:
        - A list of projects
        - The date range that they were first seen in (defaults to the last 7 days)

        If the request is successful, the return format is:
        {
            "categories": [
                {
                    "primary_label": str,
                    "associated_labels": list[str],
                    "feedback_count": int,
                }
                ...
            ],
            "success": True,
            "numFeedbacksContext": int,
        }
        It is returned as a list in the order of feedback count.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :qparam int project: project IDs to filter by
        :qparam string statsPeriod: filter feedbacks by date range (e.g. "14d")
        :qparam string start: start date range (alternative to statsPeriod)
        :qparam string end: end date range (alternative to statsPeriod)
        :auth: required
        """

        # Should we check the ingest feature flag here too?
        if not features.has(
            "organizations:user-feedback-ai-categorization-features",
            organization,
            actor=request.user,
        ) or not features.has("organizations:gen-ai-features", organization, actor=request.user):
            return Response(status=404)

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

        if end - start < timedelta(days=2):
            categorization_cache_key = f"feedback_categorization:{organization.id}:{start.strftime('%Y-%m-%d-%H')}:{end.strftime('%Y-%m-%d-%H')}:{hashed_project_ids}"
        else:
            # Date range is long enough that the categories won't change much (as long as the same day is selected)
            categorization_cache_key = f"feedback_categorization:{organization.id}:{start.strftime('%Y-%m-%d')}:{end.strftime('%Y-%m-%d')}:{hashed_project_ids}"

        categories_cache = cache.get(categorization_cache_key)
        if categories_cache:
            # return Response(
            #     {
            #         "categories": categories_cache["categories"],
            #         "success": True,
            #         "numFeedbacksContext": categories_cache["numFeedbacksContext"],
            #     }
            # )
            pass

        recent_feedbacks = query_recent_feedbacks_with_ai_labels(
            organization_id=organization.id,
            project_ids=numeric_project_ids,
            start=start,
            end=end,
            limit=MAX_FEEDBACKS_CONTEXT,
        )

        # print("\n\n THIS IS THE RECENT FEEDBACKS", recent_feedbacks, "\n\n")

        # if len(recent_feedbacks) < MIN_FEEDBACKS_CONTEXT:
        #     logger.error("Too few feedbacks to generate categories")
        #     return Response(
        #         {
        #             "categories": None,
        #             "success": False,
        #             "numFeedbacksContext": 0,
        #         }
        #     )

        context_feedbacks = []
        total_chars = 0
        for feedback in recent_feedbacks:
            total_chars += len(feedback["feedback"])
            total_chars += sum(len(label) for label in feedback["labels"])
            if total_chars > MAX_FEEDBACKS_CONTEXT_CHARS:
                break
            context_feedbacks.append(
                LabelGroupFeedbacksContext(feedback=feedback["feedback"], labels=feedback["labels"])
            )

        # Gets the top 10 labels by feedbacks to augment the context that the LLM has, instead of just asking it to generate categories without knowing the most common labels
        top_10_labels_result = query_top_ai_labels_by_feedback_count(
            organization_id=organization.id,
            project_ids=numeric_project_ids,
            start=start,
            end=end,
            limit=10,
        )

        # Guaranteed to be non-empty since there are definitely feedbacks with AI labels
        top_10_labels = [result["label"] for result in top_10_labels_result]

        seer_request = LabelGroupsRequest(
            organization_id=organization.id,
            labels=top_10_labels,
            feedbacks_context=context_feedbacks,
        )

        try:
            label_groups = json.loads(make_seer_request(seer_request).decode("utf-8"))["data"]
        except Exception:
            logger.exception("Error requesting Seer for feedback categories")
            return Response(status=502)

        # If the LLM just forgets or adds extra primary labels, we still generate categories but log it
        if len(label_groups) != len(top_10_labels):
            logger.warning(
                "Number of label groups does not match number of primary labels passed in Seer",
                extra={
                    "label_groups": label_groups,
                    "top_10_labels": top_10_labels,
                },
            )

        # If the LLM hallucinates primary label(s), log it but still generate categories
        for label_group in label_groups:
            if label_group["primary_label"] not in top_10_labels:
                logger.warning(
                    "LLM hallucinated primary label",
                    extra={"label_group": label_group},
                )

        # Converts label_groups (which maps primary label to associated labels) to a list of lists, where the first element is the primary label and the rest are the associated labels
        label_groups_lists: list[list[str]] = [
            [label_group["primary_label"]] + label_group["associated_labels"]
            for label_group in label_groups
        ]

        label_feedback_counts = query_label_group_counts(
            organization_id=organization.id,
            project_ids=numeric_project_ids,
            start=start,
            end=end,
            labels_groups=label_groups_lists,
        )

        categories = []
        for i, list_group in enumerate(label_groups_lists):
            primary_label = list_group[0]
            associated_labels = list_group[1:]

            categories.append(
                {
                    "primary_label": primary_label,
                    "associated_labels": associated_labels,
                    "feedback_count": label_feedback_counts[i],
                }
            )

        categories.sort(key=lambda x: x["feedback_count"], reverse=True)
        # XXX: maybe we should do something like figure out where the biggest drop of feedback count is and then stop there? Instead of just hardcoding getting top 4 groups
        # Another good idea is to remove categories that have a big overlap with another category - to do in the future
        categories = categories[:MAX_RETURN_CATEGORIES]

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

import logging
from datetime import timedelta
from typing import TypedDict

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3 import Retry

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
from sentry.feedback.lib.seer_api import seer_summarization_connection_pool
from sentry.grouping.utils import hash_from_values
from sentry.models.organization import Organization
from sentry.seer.seer_setup import has_seer_access
from sentry.seer.signed_seer_api import make_signed_seer_api_request
from sentry.utils import json
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


SEER_LABEL_GROUPS_ENDPOINT_PATH = "/v1/automation/summarize/feedback/label-groups"
SEER_TIMEOUT_S = 30
SEER_RETRIES = Retry(total=1, backoff_factor=3)  # 1 retry after a 3 second delay.


MIN_FEEDBACKS_CONTEXT = 10
MAX_FEEDBACKS_CONTEXT = 1000
MAX_FEEDBACKS_CONTEXT_CHARS = 1000000

MAX_RETURN_CATEGORIES = 4

# Max labels in a label group (including the primary label)
MAX_GROUP_LABELS = 12

# Number of top labels to pass to Seer to ask for similar labels
NUM_TOP_LABELS = 6

# Two days because the largest granularity we cache at is the day
CATEGORIES_CACHE_TIMEOUT = 172800

# If the number of feedbacks is less than this, we don't ask for associated labels
THRESHOLD_TO_GET_ASSOCIATED_LABELS = 50


class LabelGroupFeedbacksContext(TypedDict):
    """Corresponds to LabelGroupFeedbacksContext in Seer."""

    feedback: str
    labels: list[str]


class LabelGroupsRequest(TypedDict):
    """Corresponds to GenerateFeedbackLabelGroupsRequest in Seer."""

    labels: list[str]
    # Providing the LLM context so it knows what labels are used in the same context and are direct children
    feedbacks_context: list[LabelGroupFeedbacksContext]


class FeedbackLabelGroup(TypedDict):
    """Corresponds to FeedbackLabelGroup in Seer."""

    primaryLabel: str
    associatedLabels: list[str]


@region_silo_endpoint
class OrganizationFeedbackCategoriesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.FEEDBACK
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationUserReportsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Gets categories of feedbacks for an organization.

        Returns groups of labels, which correspond to categories, for feedbacks that can be filtered by:
        - A list of projects
        - The date range that they were first seen in (defaults to the last 7 days)

        If the request is successful, the return format is:
        {
            "categories": [
                {
                    "primaryLabel": str,
                    "associatedLabels": list[str],
                    "feedbackCount": int,
                }
                ...
            ],
            "success": True,
            "numFeedbacksContext": int,
        }
        It is returned as a list in the order of feedback count.

        Returns 500 if the Seer endpoint fails.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :qparam int project: project IDs to filter by
        :qparam string statsPeriod: filter feedbacks by date range (e.g. "14d")
        :qparam string start: start date range (alternative to statsPeriod)
        :qparam string end: end date range (alternative to statsPeriod)
        :auth: required
        """

        if not features.has(
            "organizations:user-feedback-ai-categorization-features",
            organization,
            actor=request.user,
        ) or not has_seer_access(organization, actor=request.user):
            return Response(
                {"detail": "AI categorization is not available for this organization."}, status=403
            )

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
            # Hour granularity date range.
            categorization_cache_key = f"feedback_categorization:{organization.id}:{start.strftime('%Y-%m-%d-%H')}:{end.strftime('%Y-%m-%d-%H')}:{hashed_project_ids}"
        else:
            # Day granularity date range. Date range is long enough that the categories won't change much (as long as the same day is selected)
            categorization_cache_key = f"feedback_categorization:{organization.id}:{start.strftime('%Y-%m-%d')}:{end.strftime('%Y-%m-%d')}:{hashed_project_ids}"

        has_cache = features.has(
            "organizations:user-feedback-ai-summaries-cache", organization, actor=request.user
        )

        if has_cache:
            cache_entry = cache.get(categorization_cache_key)
            if cache_entry:
                return Response(
                    {
                        "categories": cache_entry["categories"],
                        "success": True,
                        "numFeedbacksContext": cache_entry["numFeedbacksContext"],
                    }
                )

        recent_feedbacks = query_recent_feedbacks_with_ai_labels(
            organization_id=organization.id,
            project_ids=numeric_project_ids,
            start=start,
            end=end,
            limit=MAX_FEEDBACKS_CONTEXT,
        )

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
            context_feedbacks.append(
                LabelGroupFeedbacksContext(feedback=feedback["feedback"], labels=feedback["labels"])
            )

        # Gets the top labels by feedbacks to augment the context that the LLM has, instead of just asking it to generate categories without knowing the most common labels
        top_labels_result = query_top_ai_labels_by_feedback_count(
            organization_id=organization.id,
            project_ids=numeric_project_ids,
            start=start,
            end=end,
            limit=NUM_TOP_LABELS,
        )

        # Guaranteed to be non-empty since recent_feedbacks is non-empty
        top_labels = [result["label"] for result in top_labels_result]

        seer_request = LabelGroupsRequest(
            labels=top_labels,
            feedbacks_context=context_feedbacks,
        )

        if len(context_feedbacks) >= THRESHOLD_TO_GET_ASSOCIATED_LABELS:
            try:
                response = make_signed_seer_api_request(
                    connection_pool=seer_summarization_connection_pool,
                    path=SEER_LABEL_GROUPS_ENDPOINT_PATH,
                    body=json.dumps(seer_request).encode("utf-8"),
                    timeout=SEER_TIMEOUT_S,
                    retries=SEER_RETRIES,
                )
            except Exception:
                logger.exception("Seer failed to generate user feedback label groups")
                return Response(
                    {"detail": "Failed to generate user feedback label groups"}, status=500
                )
            if response.status < 200 or response.status >= 300:
                logger.error(
                    "Seer failed to generate user feedback label groups",
                    extra={"status_code": response.status, "response_data": response.data},
                )
                return Response(
                    {"detail": "Failed to generate user feedback label groups"}, status=500
                )
            label_groups = response.json()["data"]
        else:
            # If there are less than THRESHOLD_TO_GET_ASSOCIATED_LABELS feedbacks, we don't ask for associated labels
            # The more feedbacks there are, the LLM does a better job of generating associated labels since it has more context
            label_groups = [
                FeedbackLabelGroup(primaryLabel=label, associatedLabels=[]) for label in top_labels
            ]

        # If the LLM just forgets or adds extra primary labels, log it but still generate categories
        if len(label_groups) != len(top_labels):
            logger.warning(
                "Number of label groups does not match number of primary labels passed in Seer",
                extra={
                    "label_groups": label_groups,
                    "top_labels": top_labels,
                },
            )

        # If the LLM hallucinates primary label(s), log it but still generate categories
        for label_group in label_groups:
            if label_group["primaryLabel"] not in top_labels:
                logger.warning(
                    "LLM hallucinated primary label",
                    extra={"label_group": label_group},
                )

        # Sometimes, the LLM will give us associated labels that, to put it bluntly, are not associated labels.
        # For example, if the primary label is "Navigation", the LLM might give us "Usability" or "User Interface" as associated labels.
        # In a case like that, "Usability" and "User Interface" are obviously more general, so will most likely have more feedbacks associated with them than "Navigation".
        # One way to filter these out is to check the counts of each associated label, and compare that to the counts of the primary label.
        # If the count of the associated label is >3/4 of the count of the primary label, we can assume that the associated label is not a valid associated label.
        # Even if it is valid, we don't really care, it matters more that we get rid of it in the situations that it is invalid (which is pretty often).

        # Stores each label as an individual label group (so a list of lists, each inside list containing a single label)
        # This is done to get the counts of each label individually, so we can filter out invalid associated labels
        flattened_label_groups: list[list[str]] = []
        for label_group in label_groups:
            flattened_label_groups.append([label_group["primaryLabel"]])
            flattened_label_groups.extend([[label] for label in label_group["associatedLabels"]])

        individual_label_counts = query_label_group_counts(
            organization_id=organization.id,
            project_ids=numeric_project_ids,
            start=start,
            end=end,
            labels_groups=flattened_label_groups,
        )

        label_to_count = {}
        for label_lst, count in zip(flattened_label_groups, individual_label_counts):
            label_to_count[label_lst[0]] = count

        label_groups_lists: list[list[str]] = []
        for i, label_group in enumerate(label_groups):
            primary_label = label_group["primaryLabel"]
            associated_labels = label_group["associatedLabels"]
            label_groups_lists.append([primary_label])
            for associated_label in associated_labels:
                # Once we have MAX_GROUP_LABELS total labels, stop adding more
                if len(label_groups_lists[i]) >= MAX_GROUP_LABELS:
                    break
                # Ensure the associated label has feedbacks associated with it, and it doesn't have *too many* feedbacks associated with it
                # Worst case, if the associated label is wrong, <= 3/4 of the feedbacks associated with it are wrong
                if (
                    label_to_count[associated_label] * 4 <= label_to_count[primary_label] * 3
                    and label_to_count[associated_label] != 0
                ):
                    label_groups_lists[i].append(associated_label)

        # label_groups_lists might be empty if the LLM just decides not to give us any primary labels (leading to ValueError, then 500)
        # This will be logged since top_labels is guaranteed to be non-empty, but label_groups_lists will be empty
        label_feedback_counts = query_label_group_counts(
            organization_id=organization.id,
            project_ids=numeric_project_ids,
            start=start,
            end=end,
            labels_groups=label_groups_lists,
        )

        categories = []
        for i, list_group in enumerate(label_groups_lists):
            primaryLabel = list_group[0]
            associatedLabels = list_group[1:]

            categories.append(
                {
                    "primaryLabel": primaryLabel,
                    "associatedLabels": associatedLabels,
                    "feedbackCount": label_feedback_counts[i],
                }
            )

        categories.sort(key=lambda x: x["feedbackCount"], reverse=True)
        categories = categories[:MAX_RETURN_CATEGORIES]

        if has_cache:
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

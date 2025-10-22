from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models.organization import Organization


class OrganizationAIConversationsSerializer(serializers.Serializer):
    """Serializer for validating query parameters."""

    sort = serializers.CharField(required=False, default="-timestamp")
    query = serializers.CharField(required=False, allow_blank=True)

    def validate_sort(self, value):
        allowed_sorts = {
            "timestamp",
            "-timestamp",
            "duration",
            "-duration",
            "errors",
            "-errors",
            "llmCalls",
            "-llmCalls",
            "toolCalls",
            "-toolCalls",
            "totalTokens",
            "-totalTokens",
            "totalCost",
            "-totalCost",
        }
        if value not in allowed_sorts:
            raise serializers.ValidationError(f"Invalid sort option: {value}")
        return value


@region_silo_endpoint
class OrganizationAIConversationsEndpoint(OrganizationEndpoint):
    """Endpoint for fetching AI agent conversation traces."""

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.VISIBILITY

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve AI conversation traces for an organization.
        """
        if not features.has("organizations:gen-ai-conversations", organization, actor=request.user):
            return Response(status=404)

        serializer = OrganizationAIConversationsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data

        # Create paginator with data function
        def data_fn(offset: int, limit: int):
            return self._get_conversations(
                organization=organization,
                offset=offset,
                limit=limit,
                sort=validated_data.get("sort", "-timestamp"),
                query=validated_data.get("query", ""),
            )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: results,
        )

    def _get_conversations(
        self, organization: Organization, offset: int, limit: int, sort: str, query: str
    ) -> list[dict]:
        """
        Fetch conversation data. Currently returns hardcoded data.
        In the future, this will query real trace data from the database.

        Args:
            organization: The organization to fetch conversations for (unused in hardcoded implementation)
            offset: Starting index for pagination
            limit: Number of results to return
            sort: Sort field and direction
            query: Search query (unused in hardcoded implementation)
        """
        # Hardcoded sample data matching the TableData interface
        all_conversations = [
            {
                "conversationId": "conv-12345-abc",
                "flow": "Customer Support Agent → Database Query Tool → Response Generator",
                "duration": 2450,  # milliseconds
                "errors": 0,
                "llmCalls": 3,
                "toolCalls": 5,
                "totalTokens": 1250,
                "totalCost": 0.0045,
                "timestamp": 1729520400000,  # Unix timestamp in milliseconds
            },
            {
                "conversationId": "conv-67890-def",
                "flow": "Research Assistant → Web Search Tool → Summarization Agent",
                "duration": 5230,
                "errors": 1,
                "llmCalls": 5,
                "toolCalls": 8,
                "totalTokens": 3400,
                "totalCost": 0.0128,
                "timestamp": 1729520340000,
            },
            {
                "conversationId": "conv-24680-ghi",
                "flow": "Code Assistant → Documentation Tool → Code Generator",
                "duration": 3100,
                "errors": 0,
                "llmCalls": 4,
                "toolCalls": 6,
                "totalTokens": 2100,
                "totalCost": 0.0078,
                "timestamp": 1729520280000,
            },
            {
                "conversationId": "conv-13579-jkl",
                "flow": "Translation Agent → Language Detection → Translation Service",
                "duration": 1800,
                "errors": 0,
                "llmCalls": 2,
                "toolCalls": 3,
                "totalTokens": 950,
                "totalCost": 0.0032,
                "timestamp": 1729520220000,
            },
            {
                "conversationId": "conv-86420-mno",
                "flow": "Data Analysis Agent → SQL Tool → Visualization Generator",
                "duration": 4500,
                "errors": 2,
                "llmCalls": 6,
                "toolCalls": 9,
                "totalTokens": 4200,
                "totalCost": 0.0156,
                "timestamp": 1729520160000,
            },
            {
                "conversationId": "conv-97531-pqr",
                "flow": "Email Assistant → Calendar Tool → Draft Generator",
                "duration": 2900,
                "errors": 0,
                "llmCalls": 3,
                "toolCalls": 4,
                "totalTokens": 1600,
                "totalCost": 0.0058,
                "timestamp": 1729520100000,
            },
            {
                "conversationId": "conv-15935-stu",
                "flow": "Content Moderator → Toxicity Detector → Classification Agent",
                "duration": 1200,
                "errors": 0,
                "llmCalls": 2,
                "toolCalls": 2,
                "totalTokens": 680,
                "totalCost": 0.0024,
                "timestamp": 1729520040000,
            },
            {
                "conversationId": "conv-75395-vwx",
                "flow": "Image Analysis Agent → Vision Model → Description Generator",
                "duration": 6200,
                "errors": 1,
                "llmCalls": 4,
                "toolCalls": 5,
                "totalTokens": 2800,
                "totalCost": 0.0112,
                "timestamp": 1729519980000,
            },
            {
                "conversationId": "conv-35795-yza",
                "flow": "Sentiment Analyzer → Text Preprocessor → Classification Model",
                "duration": 1500,
                "errors": 0,
                "llmCalls": 2,
                "toolCalls": 3,
                "totalTokens": 850,
                "totalCost": 0.0029,
                "timestamp": 1729519920000,
            },
            {
                "conversationId": "conv-95135-bcd",
                "flow": "Product Recommender → User Profile Tool → Recommendation Engine",
                "duration": 3400,
                "errors": 0,
                "llmCalls": 5,
                "toolCalls": 7,
                "totalTokens": 2500,
                "totalCost": 0.0095,
                "timestamp": 1729519860000,
            },
        ]

        # Apply sorting (basic implementation for hardcoded data)
        reverse = sort.startswith("-")
        sort_key = sort[1:] if reverse else sort

        # Map frontend field names to dict keys
        if sort_key in all_conversations[0]:
            all_conversations.sort(
                key=lambda x: x[sort_key] if x[sort_key] is not None else 0, reverse=reverse
            )

        # Apply pagination
        return all_conversations[offset : offset + limit]

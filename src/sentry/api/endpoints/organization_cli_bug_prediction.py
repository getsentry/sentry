import logging
import time

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3.exceptions import MaxRetryError
from urllib3.exceptions import TimeoutError as UrllibTimeoutError

from sentry import features, ratelimits
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.serializers.rest_framework.cli_bug_prediction import (
    CliBugPredictionRequestSerializer,
)
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.cli_bug_prediction import get_cli_bug_prediction_status, trigger_cli_bug_prediction
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationCodeReviewLocalEndpoint(OrganizationEndpoint):
    """
    Handle local code review requests from sentry-cli.

    Synchronously polls Seer and returns results.
    """

    owner = ApiOwner.ML_AI
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationIntegrationsPermission,)

    def post(self, request: Request, organization: Organization) -> Response:
        """
        Trigger local code review for a git diff from sentry-cli.

        This endpoint:
        1. Validates the request (diff size, file count, etc.)
        2. Resolves the repository and checks permissions
        3. Triggers Seer analysis
        4. Polls Seer for completion (up to 10 minutes)
        5. Returns predictions or error

        Returns 200 with predictions on success, various error codes on failure.
        """
        # Check if feature is globally enabled
        if not settings.CODE_REVIEW_LOCAL_ENABLED:
            return Response(
                {"detail": "Local code review is not enabled"},
                status=503,
            )

        # Check feature flag
        if not features.has("organizations:code-review-local", organization):
            return Response(
                {"detail": "Local code review is not enabled for this organization"},
                status=403,
            )

        # Rate limiting
        user_key = f"code_review_local:user:{request.user.id}"
        org_key = f"code_review_local:org:{organization.id}"

        user_limit, user_window = settings.CODE_REVIEW_LOCAL_USER_RATE_LIMIT
        org_limit, org_window = settings.CODE_REVIEW_LOCAL_ORG_RATE_LIMIT

        if ratelimits.backend.is_limited(user_key, limit=user_limit, window=user_window):
            metrics.incr("code_review_local.rate_limited", tags={"type": "user"})
            return Response(
                {
                    "detail": f"Rate limit exceeded. Maximum {user_limit} requests per {user_window // 3600} hour(s) per user"
                },
                status=429,
            )

        if ratelimits.backend.is_limited(org_key, limit=org_limit, window=org_window):
            metrics.incr("code_review_local.rate_limited", tags={"type": "org"})
            return Response(
                {
                    "detail": f"Organization rate limit exceeded. Maximum {org_limit} requests per {org_window // 3600} hour(s)"
                },
                status=429,
            )

        # Validate request
        serializer = CliBugPredictionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)

        validated_data = serializer.validated_data
        repo_data = validated_data["repository"]
        diff = validated_data["diff"]
        commit_message = validated_data.get("commit_message")

        # Resolve repository
        # Repository names in the database are stored as "owner/name" (e.g., "getsentry/sentry")
        full_repo_name = f"{repo_data['owner']}/{repo_data['name']}"
        try:
            repository = self._resolve_repository(
                organization=organization,
                repo_name=full_repo_name,
                repo_provider=repo_data["provider"],
            )
        except Repository.DoesNotExist:
            return Response(
                {
                    "detail": f"Repository {full_repo_name} not found. "
                    "Please ensure the repository is connected to Sentry via an integration."
                },
                status=404,
            )

        # Log request
        logger.info(
            "code_review_local.request",
            extra={
                "organization_id": organization.id,
                "user_id": request.user.id,
                "repository_id": repository.id,
                "diff_size_bytes": len(diff),
            },
        )

        metrics.incr("code_review_local.request", tags={"org": organization.slug})

        # Trigger Seer
        # user.id is guaranteed to be non-None since this endpoint requires authentication
        user_id = request.user.id
        assert user_id is not None
        user_name = request.user.username or getattr(request.user, "email", None) or str(user_id)

        try:
            trigger_response = trigger_cli_bug_prediction(
                repo_provider=repo_data["provider"],
                repo_owner=repo_data["owner"],
                repo_name=repo_data["name"],
                repo_external_id=repository.external_id or "",
                base_commit_sha=repo_data["base_commit_sha"],
                diff=diff,
                organization_id=organization.id,
                organization_slug=organization.slug,
                user_id=user_id,
                user_name=user_name,
                commit_message=commit_message,
            )
        except (UrllibTimeoutError, MaxRetryError):
            logger.exception(
                "code_review_local.trigger.timeout",
                extra={
                    "organization_id": organization.id,
                    "user_id": request.user.id,
                },
            )
            return Response(
                {"detail": "Code review service is temporarily unavailable"}, status=503
            )
        except ValueError as e:
            logger.exception(
                "code_review_local.trigger.error",
                extra={
                    "organization_id": organization.id,
                    "user_id": request.user.id,
                    "error": str(e),
                },
            )
            # Include the error message from Seer if available
            error_msg = str(e)
            if "Seer error" in error_msg:
                return Response({"detail": error_msg}, status=502)
            return Response({"detail": "Failed to start code review analysis"}, status=502)
        except Exception as e:
            # Catch-all for unexpected errors
            logger.exception(
                "code_review_local.trigger.unexpected_error",
                extra={
                    "organization_id": organization.id,
                    "user_id": request.user.id,
                    "error_type": type(e).__name__,
                    "error": str(e),
                },
            )
            return Response(
                {"detail": f"Unexpected error during code review: {type(e).__name__}"},
                status=500,
            )

        run_id = trigger_response["run_id"]

        logger.info(
            "code_review_local.seer_triggered",
            extra={
                "seer_run_id": run_id,
                "organization_id": organization.id,
                "user_id": request.user.id,
            },
        )

        # Poll for results
        try:
            final_response = self._poll_seer_for_results(
                run_id=run_id,
                timeout_seconds=settings.CODE_REVIEW_LOCAL_TIMEOUT,
                poll_interval_seconds=settings.CODE_REVIEW_LOCAL_POLL_INTERVAL,
            )
        except TimeoutError:
            logger.exception(
                "code_review_local.timeout",
                extra={
                    "seer_run_id": run_id,
                    "organization_id": organization.id,
                    "user_id": request.user.id,
                },
            )
            metrics.incr("code_review_local.timeout")
            return Response(
                {
                    "detail": "Analysis exceeded maximum processing time (10 minutes). Please try again with a smaller diff."
                },
                status=504,
            )
        except ValueError as e:
            # Seer returned error status
            status_code, error_code, error_message = self._map_seer_error_to_response(str(e))
            logger.exception(
                "code_review_local.seer_error",
                extra={
                    "seer_run_id": run_id,
                    "organization_id": organization.id,
                    "user_id": request.user.id,
                    "mapped_status": status_code,
                },
            )
            metrics.incr("code_review_local.seer_error", tags={"error_code": error_code})
            return Response({"detail": error_message}, status=status_code)

        # Success
        predictions = final_response.get("predictions", [])
        diagnostics = final_response.get("diagnostics", {})

        logger.info(
            "code_review_local.completed",
            extra={
                "seer_run_id": run_id,
                "organization_id": organization.id,
                "user_id": request.user.id,
                "predictions_count": len(predictions),
                "status": final_response.get("status"),
            },
        )

        metrics.incr("code_review_local.completed", tags={"status": "success"})
        metrics.incr("code_review_local.predictions", amount=len(predictions))

        response_data = {
            "status": final_response.get("status"),
            "predictions": predictions,
            "diagnostics": diagnostics,
            "seer_run_id": run_id,
        }

        return Response(response_data, status=200)

    def _resolve_repository(
        self, organization: Organization, repo_name: str, repo_provider: str
    ) -> Repository:
        """
        Resolve repository by name and provider.

        Args:
            organization: Organization object
            repo_name: Repository name (e.g., "sentry")
            repo_provider: Provider name (e.g., "github")

        Returns:
            Repository object

        Raises:
            Repository.DoesNotExist: If repository not found
        """
        # Map simple provider names to integration provider names
        # Repositories created via integrations use "integrations:github" format
        provider_variants = [repo_provider]
        if not repo_provider.startswith("integrations:"):
            provider_variants.append(f"integrations:{repo_provider}")

        return Repository.objects.get(
            organization_id=organization.id, name=repo_name, provider__in=provider_variants
        )

    def _poll_seer_for_results(
        self, run_id: int, timeout_seconds: int = 600, poll_interval_seconds: int = 2
    ) -> dict:
        """
        Poll Seer until completion, error, or timeout.

        Args:
            run_id: Seer run ID to poll
            timeout_seconds: Maximum time to wait (default 10 minutes)
            poll_interval_seconds: Time between polls (default 2 seconds)

        Returns:
            Final response from Seer

        Raises:
            TimeoutError: If timeout exceeded
            ValueError: If Seer returns error status
        """
        start_time = time.time()
        attempt = 0

        while True:
            elapsed = time.time() - start_time
            if elapsed >= timeout_seconds:
                raise TimeoutError("CLI review processing exceeded timeout")

            attempt += 1
            logger.debug(
                "code_review_local.polling",
                extra={
                    "seer_run_id": run_id,
                    "attempt": attempt,
                    "elapsed_seconds": elapsed,
                },
            )

            try:
                response = get_cli_bug_prediction_status(run_id)
            except (UrllibTimeoutError, MaxRetryError):
                # If status check times out, wait and retry
                logger.warning(
                    "code_review_local.poll.timeout",
                    extra={"seer_run_id": run_id, "attempt": attempt},
                )
                time.sleep(poll_interval_seconds)
                continue

            status = response.get("status")

            if status == "completed":
                return response
            elif status == "errored":
                error_message = response.get("error_message", "Unknown error from Seer")
                raise ValueError(error_message)
            elif status in ("pending", "in_progress"):
                time.sleep(poll_interval_seconds)
                continue
            else:
                raise ValueError(f"Unknown status from Seer: {status}")

    def _map_seer_error_to_response(self, seer_error_message: str) -> tuple[int, str, str]:
        """
        Map Seer error messages to HTTP status codes and friendly messages.

        Args:
            seer_error_message: Error message from Seer

        Returns:
            Tuple of (status_code, error_code, user_message)
        """
        error_lower = seer_error_message.lower()

        if "base commit not found" in error_lower or "commit not found" in error_lower:
            return (
                400,
                "base_commit_not_found",
                "Base commit must be pushed to the remote repository before running CLI review",
            )

        if "exceeds 500kb" in error_lower or "diff too large" in error_lower:
            return (
                400,
                "diff_too_large",
                "Diff exceeds the 500KB size limit. Please reduce the number of changes.",
            )

        if "exceeds 50 files" in error_lower or "too many files" in error_lower:
            return (
                400,
                "too_many_files",
                "Diff contains more than 50 files. Please reduce the number of files changed.",
            )

        if "failed to clone" in error_lower or "repository not accessible" in error_lower:
            return (
                502,
                "repository_clone_failed",
                "Unable to access the repository. Please check repository permissions.",
            )

        # Default to bad gateway for unknown Seer errors
        return (502, "bad_gateway", "Code review service encountered an error")

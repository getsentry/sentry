from __future__ import annotations

import logging
from typing import Any

import orjson
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupAiEndpoint
from sentry.autofix.utils import get_autofix_state
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.issues.auto_source_code_config.code_mapping import get_sorted_code_mapping_configs
from sentry.models.group import Group
from sentry.models.repository import Repository
from sentry.seer.autofix import trigger_autofix
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

from rest_framework.request import Request


@region_silo_endpoint
class GroupAutofixEndpoint(GroupAiEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=25, window=60),
            RateLimitCategory.USER: RateLimit(limit=25, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=100, window=60 * 60),  # 1 hour
        },
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=1024, window=60),
            RateLimitCategory.USER: RateLimit(limit=1024, window=60),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=8192, window=60),
        },
    }

    def post(self, request: Request, group: Group) -> Response:
        data = orjson.loads(request.body)

        return trigger_autofix(
            group=group,
            # This event_id is the event that the user is looking at when they click the "Fix" button
            event_id=data.get("event_id", None),
            user=request.user,
            instruction=data.get("instruction", None),
            pr_to_comment_on_url=data.get("pr_to_comment_on_url", None),
        )

    def get(self, request: Request, group: Group) -> Response:
        access_check_cache_key = f"autofix_access_check:{group.id}"
        access_check_cache_value = cache.get(access_check_cache_key)

        check_repo_access = False
        if not access_check_cache_value:
            check_repo_access = True

        is_user_watching = request.GET.get("isUserWatching", False)

        autofix_state = get_autofix_state(
            group_id=group.id,
            check_repo_access=check_repo_access,
            is_user_fetching=bool(is_user_watching),
        )

        if check_repo_access:
            cache.set(access_check_cache_key, True, timeout=60)  # 1 minute timeout

        response_state: dict[str, Any] | None = None

        if autofix_state:
            response_state = autofix_state.dict()
            user_ids = autofix_state.actor_ids
            if user_ids:
                users = user_service.serialize_many(
                    filter={"user_ids": user_ids, "organization_id": request.organization.id},
                    as_user=request.user,
                )

                users_map = {user["id"]: user for user in users}

                response_state["users"] = users_map

            project = group.project
            repositories = []

            autofix_codebase_state = response_state.get("codebases", {})

            repo_code_mappings: dict[str, RepositoryProjectPathConfig] = {}
            if project:
                code_mappings = get_sorted_code_mapping_configs(project=project)
                for mapping in code_mappings:
                    if mapping.repository.external_id:
                        repo_code_mappings[mapping.repository.external_id] = mapping

            for repo_external_id, repo_state in autofix_codebase_state.items():
                retrieved_mapping: RepositoryProjectPathConfig | None = repo_code_mappings.get(
                    repo_external_id, None
                )

                if not retrieved_mapping:
                    continue

                mapping_repo: Repository = retrieved_mapping.repository

                repositories.append(
                    {
                        "integration_id": mapping_repo.integration_id,
                        "url": mapping_repo.url,
                        "external_id": repo_external_id,
                        "name": mapping_repo.name,
                        "provider": mapping_repo.provider,
                        "default_branch": retrieved_mapping.default_branch,
                        "is_readable": repo_state.get("is_readable", None),
                        "is_writeable": repo_state.get("is_writeable", None),
                    }
                )

            response_state["repositories"] = repositories

            # Remove unnecessary or sensitive data to reduce returned payload size
            for key in ["usage", "signals"]:
                response_state.pop(key, None)
            for request_key in ["issue", "trace_tree", "profile", "issue_summary", "logs"]:
                if "request" in response_state and request_key in response_state["request"]:
                    del response_state["request"][request_key]

        return Response({"autofix": response_state})

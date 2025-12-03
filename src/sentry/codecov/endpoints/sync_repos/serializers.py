import logging

import sentry_sdk
from rest_framework import serializers, status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class CodecovGraphQlError(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "Codecov GraphQL returned an invalid response."
    default_code = "codecov-graphql-error"


class SyncReposSerializer(serializers.Serializer):
    """
    Serializer for a sync repository response
    """

    isSyncing = serializers.BooleanField()

    def to_representation(self, graphql_response):
        """
        Transform the GraphQL response to the serialized format
        """
        try:
            http_method = self.context.get("http_method") or "UNKNOWN"
            data_key = "syncRepos" if http_method == "POST" else "me"

            data = graphql_response["data"][data_key]
            if data is None:
                self._raise_graphql_error(graphql_response, http_method, data_key)

            response_data = {
                "isSyncing": data["isSyncing"],
            }

            return super().to_representation(response_data)

        except (KeyError, TypeError) as e:
            sentry_sdk.capture_exception(e)
            logger.exception(
                "Error parsing GraphQL response",
                extra={
                    "error": str(e),
                    "endpoint": "sync-repos",
                    "response_keys": (
                        list(graphql_response.keys())
                        if isinstance(graphql_response, dict)
                        else None
                    ),
                },
            )
            raise

    def _raise_graphql_error(self, graphql_response, http_method: str, data_key: str) -> None:
        formatted_errors = self._format_graphql_errors(graphql_response)
        detail = (
            f"Codecov GraphQL response for `{data_key}` was empty while handling {http_method}."
        )
        if formatted_errors:
            detail = f"{detail} Upstream error(s): {formatted_errors}"

        logger.error(
            "codecov.sync_repos.graphql_missing_data",
            extra={
                "endpoint": "sync-repos",
                "http_method": http_method,
                "data_key": data_key,
                "has_errors": bool(formatted_errors),
            },
        )
        raise CodecovGraphQlError(detail)

    @staticmethod
    def _format_graphql_errors(graphql_response) -> str | None:
        if not isinstance(graphql_response, dict):
            return None

        errors = graphql_response.get("errors")
        if not isinstance(errors, list):
            return None

        formatted_errors: list[str] = []
        for error in errors:
            if isinstance(error, dict):
                message = error.get("message")
                path = error.get("path")
                if message and path and isinstance(path, (list, tuple)):
                    path_str = "/".join(str(segment).strip("'\"") for segment in path)
                    formatted_errors.append(f"{message} (path: {path_str})")
                elif message:
                    formatted_errors.append(str(message))
                elif path and isinstance(path, (list, tuple)):
                    path_str = "/".join(str(segment).strip("'\"") for segment in path)
                    formatted_errors.append(f"path: {path_str}")
            elif isinstance(error, str):
                formatted_errors.append(error)

        return "; ".join(formatted_errors) if formatted_errors else None

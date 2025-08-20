from __future__ import annotations

from abc import ABC, abstractmethod
from urllib.parse import quote as urlquote
from urllib.parse import unquote, urlparse, urlunparse

import sentry_sdk

from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.shared_integrations.exceptions import ApiError, IntegrationError


class CodeStoreIntegration(IntegrationInstallation, ABC):
    """
    Base class for integrations that provide access to source code files
    but don't follow traditional repository patterns (like Perforce P4).

    Unlike RepositoryIntegration, this class is focused on file access
    and stacktrace linking capabilities rather than repository management.
    """

    @property
    @abstractmethod
    def integration_name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_client(self) -> CodeStoreClient:
        """Returns the client for the integration. The client must be a subclass of CodeStoreClient."""
        raise NotImplementedError

    @abstractmethod
    def source_url_matches(self, url: str) -> bool:
        """Checks if the url matches the integration's source url. Used for stacktrace linking."""
        raise NotImplementedError

    @abstractmethod
    def format_source_url(self, filepath: str, revision: int | None = None) -> str:
        """Formats the source code url used for stacktrace linking."""
        raise NotImplementedError

    @abstractmethod
    def extract_source_path_from_source_url(self, url: str) -> str:
        """Extracts the source path from the source code url. Used for stacktrace linking."""
        raise NotImplementedError

    def record_event(self, event: SCMIntegrationInteractionType) -> SCMIntegrationInteractionEvent:
        return SCMIntegrationInteractionEvent(
            interaction_type=event,
            provider_key=self.integration_name,
            organization_id=self.organization.id,
            integration_id=self.org_integration.integration_id,
        )

    def check_file(self, filepath: str, revision: int | None = None) -> str | None:
        """
        Calls the client's `check_file` method to see if the file exists.
        Returns the link to the file if it exists, otherwise return `None`.

        filepath: file from the stacktrace (string)
        revision: specific revision/changelist (string)
        """
        with self.record_event(SCMIntegrationInteractionType.CHECK_FILE).capture() as lifecycle:
            filepath = filepath.lstrip("/")
            try:
                client = self.get_client()
            except IntegrationError:
                sentry_sdk.capture_exception()
                return None
            try:
                response = client.check_file(filepath, revision)
                if not response:
                    return None
            except ApiError as e:
                if e.code in (404, 400):
                    lifecycle.record_halt(e)
                    return None
                else:
                    sentry_sdk.capture_exception()
                    raise

            return self.format_source_url(filepath, revision)

    def get_stacktrace_link(
        self, filepath: str, default_revision: int | None, version: int | None
    ) -> str | None:
        """
        Handle formatting and returning back the stack trace link if the client
        request was successful.

        Uses the version first, and re-tries with the default revision if we 404
        trying to use the version.

        If no file was found return `None`, and re-raise for non-"Not Found"
        errors.
        """
        with self.record_event(
            SCMIntegrationInteractionType.GET_STACKTRACE_LINK
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "filepath": filepath,
                    "default_revision": default_revision or "",
                    "version": version or "",
                    "organization_id": self.organization_id,
                }
            )
            scope = sentry_sdk.get_isolation_scope()
            scope.set_tag("stacktrace_link.tried_version", False)

            def encode_url(url: str) -> str:
                parsed = urlparse(url)
                # Decode the path first to avoid double-encoding
                decoded_path = unquote(parsed.path)
                # Encode only unencoded elements
                encoded_path = urlquote(decoded_path, safe="/")
                # Encode elements of the filepath like square brackets
                # Preserve path separators and query params etc.
                return urlunparse(parsed._replace(path=encoded_path))

            if version:
                scope.set_tag("stacktrace_link.tried_version", True)
                source_url = self.check_file(filepath, version)
                if source_url:
                    scope.set_tag("stacktrace_link.used_version", True)
                    return encode_url(source_url)

            scope.set_tag("stacktrace_link.used_version", False)
            source_url = self.check_file(filepath, default_revision)
            return encode_url(source_url) if source_url else None


class CodeStoreClient(ABC):
    """
    Base client for code store integrations.

    Unlike RepositoryClient, this doesn't assume repository-based operations
    and focuses on direct file access capabilities.
    """

    base_url: str

    @abstractmethod
    def check_file(self, filepath: str, revision: int | None) -> bool:
        """Check if the file exists at the given revision."""
        raise NotImplementedError

    @abstractmethod
    def get_file_content(self, filepath: str, revision: int | None) -> str:
        """Get the file contents at the given revision."""
        raise NotImplementedError

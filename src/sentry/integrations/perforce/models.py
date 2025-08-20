from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PerforceFileInfo:
    """
    Represents file information from P4 Code Review API response.

    Based on the P4 Code Review v11 API response schema for file information.
    """

    filename: str
    content_link: str
    file_revision: str
    content_type: str
    change_id: str

    @classmethod
    def from_api_response(cls, response_data: dict[str, Any]) -> PerforceFileInfo | None:
        """
        Create a PerforceFileInfo instance from API response data.

        Args:
            response_data: The API response dict containing 'data' field

        Returns:
            PerforceFileInfo instance or None if data is invalid
        """
        if not response_data or "data" not in response_data:
            return None

        data = response_data["data"]

        try:
            return cls(
                filename=data["filename"],
                content_link=data["contentLink"],
                file_revision=data["fileRevision"],
                content_type=data["contentType"],
                change_id=data["changeId"],
            )
        except KeyError:
            # Missing required fields
            return None

    def get_depot_path(self) -> str:
        """Get the depot path from filename."""
        return self.filename

    def get_change_number(self) -> int:
        """Get the change number as an integer."""
        return int(self.change_id)

    def get_revision_number(self) -> int:
        """Get the revision number from fileRevision (e.g. "#3" -> 3)."""
        return int(self.file_revision.lstrip("#"))

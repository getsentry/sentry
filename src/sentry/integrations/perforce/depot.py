from __future__ import annotations

import base64


class PerforceDepot:
    """
    Represents a Perforce depot path with utilities for encoding.

    Handles the encoding of depot paths for use with P4 Code Review APIs,
    including proper base64 encoding of the full path with leading //.
    """

    def __init__(self, depot_path: str):
        """
        Initialize a Perforce depot path.

        Args:
            depot_path: Full depot path including leading // (e.g. //depot/path/to/file.py)
        """
        if not depot_path.startswith("//"):
            depot_path = "//" + depot_path.lstrip("/")

        self.depot_path = depot_path

    def encode_path(self, file_path: str) -> str:
        """
        Base64 encode the full depot path including the leading //.

        Returns:
            Base64 encoded depot path
        """
        full_path = f"{self.depot_path}/{file_path or ''}"
        return base64.b64encode(full_path.encode("utf-8")).decode("ascii")

    def get_raw_path(self) -> str:
        """
        Get the raw depot path.

        Returns:
            The full depot path with leading //
        """
        return self.depot_path

    def get_path_without_prefix(self) -> str:
        """
        Get the depot path without the leading //.

        Returns:
            Depot path without the // prefix
        """
        return self.depot_path.lstrip("/")

    def __str__(self) -> str:
        return self.depot_path

    def __repr__(self) -> str:
        return f"PerforceDepot('{self.depot_path}')"

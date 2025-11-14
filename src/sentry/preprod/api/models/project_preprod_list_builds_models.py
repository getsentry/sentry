from __future__ import annotations
from typing import int

from pydantic import BaseModel

from sentry.preprod.api.models.project_preprod_build_details_models import BuildDetailsApiResponse


class PaginationInfo(BaseModel):
    next: int | None
    prev: int | None
    has_next: bool
    has_prev: bool
    page: int
    per_page: int
    total_count: int | str


class ListBuildsApiResponse(BaseModel):
    builds: list[BuildDetailsApiResponse]
    pagination: PaginationInfo

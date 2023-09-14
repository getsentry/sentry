from typing import Any, Dict, Optional

from snuba_sdk import Request

from sentry.sentry_metrics.use_case_id_registry import UseCaseID


def run_query(
    request: Request, use_case_id: UseCaseID, tenant_ids: Optional[Dict[str, Any]] = None
):
    """TODO: write doc string"""
    pass

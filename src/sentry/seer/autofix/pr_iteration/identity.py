"""The two kinds of runs that can receive PR-iteration feedback.

Autofix iterations belong to an issue (and derive their project from it).
Ad-hoc iterations belong to the conversation, without issue context.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from sentry import features
from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.pr_iteration.constants import AD_HOC_FLAG


class AutofixIterationIdentity(BaseModel):
    type: Literal["autofix"] = "autofix"
    group_id: int

    class Config:
        extra = "forbid"
        frozen = True


class AdHocIterationIdentity(BaseModel):
    type: Literal["ad_hoc"] = "ad_hoc"

    class Config:
        extra = "forbid"
        frozen = True


IterationIdentity = Annotated[
    AutofixIterationIdentity | AdHocIterationIdentity, Field(discriminator="type")
]


def iteration_identity_from_run(
    run_state: SeerRunState, organization_id: int
) -> IterationIdentity | None:
    """Resolve an eligible run at the SCM ingestion boundary.

    Autofix runs remain issue-scoped. A run without an issue is ad hoc when its
    organization has ``AD_HOC_FLAG``. Other flags and access checks still apply
    downstream.
    """
    group_id = (run_state.metadata or {}).get("group_id")
    if group_id is not None:
        return AutofixIterationIdentity(group_id=group_id)
    if features.has(AD_HOC_FLAG, Organization.objects.get_from_cache(id=organization_id)):
        return AdHocIterationIdentity()
    return None


def is_ad_hoc_run(run_state: SeerRunState) -> bool:
    """For a run already resolved as eligible: ad hoc runs are the ones without an issue."""
    return (run_state.metadata or {}).get("group_id") is None

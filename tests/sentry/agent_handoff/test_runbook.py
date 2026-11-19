from unittest.mock import patch

import pytest
from pydantic import ValidationError

from sentry.agent_handoff.codes import (
    AddFeatureContext,
    AddFeatureProduct,
    HandoffFlow,
    ProjectSetupContext,
)
from sentry.agent_handoff.flows import get_flow
from sentry.agent_handoff.flows.base import InvalidHandoffContext
from sentry.agent_handoff.runbook import render_claim_runbook
from sentry.organizations.services.organization.model import RpcOnboardingReportingCode
from sentry.projects.services.project.model import RpcProject


def test_claim_runbook_installs_cli_with_handoff() -> None:
    guide = render_claim_runbook(sentry_url="https://sentry.io")

    assert guide.startswith("# Sentry for Agents\n")
    assert "curl -fsSL https://cli.sentry.dev/install | SENTRY_HANDOFF=HANDOFF_CODE bash" in guide
    assert "$env:SENTRY_HANDOFF = 'HANDOFF_CODE'" in guide
    assert "irm https://cli.sentry.dev/install.ps1 | iex" in guide
    assert "SENTRY_HOST" not in guide


def test_claim_runbook_targets_self_hosted_instance() -> None:
    guide = render_claim_runbook(sentry_url="https://sentry.example.com")

    assert (
        "curl -fsSL https://cli.sentry.dev/install | "
        "SENTRY_HOST=https://sentry.example.com SENTRY_HANDOFF=HANDOFF_CODE bash"
    ) in guide
    assert (
        "$env:SENTRY_HOST = 'https://sentry.example.com'\n$env:SENTRY_HANDOFF = 'HANDOFF_CODE'\n"
        "irm https://cli.sentry.dev/install.ps1 | iex"
    ) in guide


def test_onboarding_claim_issues_reporting_code() -> None:
    context = ProjectSetupContext(run_id="a" * 32)
    with patch(
        "sentry.agent_handoff.flows.onboarding.organization_service.issue_onboarding_reporting_code",
        return_value=RpcOnboardingReportingCode(code="a1B2c3D4e5"),
    ) as issue:
        guide = get_flow(HandoffFlow.ONBOARDING).render(
            context,
            user_id=1,
            organization_id=2,
        )
    issue.assert_called_once_with(organization_id=2, user_id=1, run_id=context.run_id)
    assert "Your onboarding run code is `a1B2c3D4e5`" in guide
    assert "using the organization slug above" in guide
    assert "guide's Onboarding Progress section" in guide
    assert "https://docs.sentry.io/index.md" in guide
    assert "(https://docs.sentry.io/ai/agent-setup/get-started.md), both with `curl -sS`" in guide


def test_create_project_claim_issues_reporting_code() -> None:
    context = ProjectSetupContext(run_id="a" * 32)
    with patch(
        "sentry.agent_handoff.flows.create_project."
        "organization_service.issue_onboarding_reporting_code",
        return_value=RpcOnboardingReportingCode(code="a1B2c3D4e5"),
    ) as issue:
        guide = get_flow(HandoffFlow.CREATE_PROJECT).render(
            context,
            user_id=1,
            organization_id=2,
        )
    issue.assert_called_once_with(organization_id=2, user_id=1, run_id=context.run_id)
    assert "helping an existing Sentry user set up a new project" in guide
    assert "Your onboarding run code is `a1B2c3D4e5`" in guide
    assert "https://docs.sentry.io/index.md" in guide
    assert "(https://docs.sentry.io/ai/agent-setup/get-started.md), both with `curl -sS`" in guide


def test_create_project_claim_rejects_unavailable_run() -> None:
    with (
        patch(
            "sentry.agent_handoff.flows.create_project."
            "organization_service.issue_onboarding_reporting_code",
            return_value=None,
        ),
        pytest.raises(InvalidHandoffContext),
    ):
        get_flow(HandoffFlow.CREATE_PROJECT).render(
            ProjectSetupContext(run_id="a" * 32),
            user_id=1,
            organization_id=2,
        )


def test_onboarding_preview_does_not_issue_reporting_code() -> None:
    with patch(
        "sentry.agent_handoff.flows.onboarding.organization_service.issue_onboarding_reporting_code"
    ) as issue:
        guide = get_flow(HandoffFlow.ONBOARDING).preview()
    assert "<onboarding-run-code>" in guide
    issue.assert_not_called()


def test_onboarding_claim_rejects_unavailable_run() -> None:
    with (
        patch(
            "sentry.agent_handoff.flows.onboarding.organization_service.issue_onboarding_reporting_code",
            return_value=None,
        ),
        pytest.raises(InvalidHandoffContext),
    ):
        get_flow(HandoffFlow.ONBOARDING).render(
            ProjectSetupContext(run_id="a" * 32),
            user_id=1,
            organization_id=2,
        )


def test_onboarding_claim_requires_run_context() -> None:
    with pytest.raises(ValidationError):
        get_flow(HandoffFlow.ONBOARDING).render(None, user_id=1, organization_id=2)


def test_guided_next_steps_claim() -> None:
    flow = get_flow(HandoffFlow.GUIDED_NEXT_STEPS)
    assert flow.get_context_serializer() is None
    assert flow.render(None, user_id=1, organization_id=2) == flow.preview()


def test_onboarding_context_serializer_validates_run_without_issuing_code() -> None:
    context_serializer = get_flow(HandoffFlow.ONBOARDING).get_context_serializer()
    assert context_serializer is not None
    serializer = context_serializer(
        data={"runId": "a" * 32}, context={"user_id": 1, "organization_id": 2}
    )
    with (
        patch(
            "sentry.agent_handoff.flows.onboarding.organization_service.has_active_onboarding_run",
            return_value=True,
        ) as validate,
        patch(
            "sentry.agent_handoff.flows.onboarding.organization_service.issue_onboarding_reporting_code"
        ) as issue,
    ):
        assert serializer.is_valid(), serializer.errors

    assert serializer.validated_data == ProjectSetupContext(run_id="a" * 32)
    validate.assert_called_once_with(organization_id=2, user_id=1, run_id="a" * 32)
    issue.assert_not_called()


def test_add_feature_preview_uses_instrument_guide() -> None:
    guide = get_flow(HandoffFlow.ADD_FEATURE).preview()
    assert "add tracing to a project" in guide
    assert "Project slug: example\\-project" in guide
    assert "https://docs.sentry.io/index.md" in guide
    assert "(https://docs.sentry.io/ai/agent-setup/instrument.md), both with `curl -sS`" in guide
    assert "add only tracing" in guide


def test_add_feature_claim_renders_product_and_project() -> None:
    context = AddFeatureContext(product=AddFeatureProduct.TRACING, project_id=99)
    with patch(
        "sentry.agent_handoff.flows.add_feature.get_accessible_project",
        return_value=RpcProject(id=99, slug="checkout-web", organization_id=2),
    ):
        guide = get_flow(HandoffFlow.ADD_FEATURE).render(context, user_id=1, organization_id=2)
    assert "instrument.md" in guide
    assert "checkout\\-web" in guide
    assert "tracing" in guide
    assert "run code" not in guide


def test_add_feature_project_slug_is_escaped() -> None:
    context = AddFeatureContext(product=AddFeatureProduct.TRACING, project_id=99)
    with patch(
        "sentry.agent_handoff.flows.add_feature.get_accessible_project",
        return_value=RpcProject(
            id=99, slug="[link](https://evil.example.com)\n# Inject", organization_id=2
        ),
    ):
        guide = get_flow(HandoffFlow.ADD_FEATURE).render(context, user_id=1, organization_id=2)
    assert r"\[link\]\(https://evil\.example\.com\) \# Inject" in guide
    assert "https://evil.example.com" not in guide.splitlines()[0]


def test_add_feature_claim_rejects_unavailable_project() -> None:
    context = AddFeatureContext(product=AddFeatureProduct.TRACING, project_id=99)
    with (
        patch(
            "sentry.agent_handoff.flows.add_feature.get_accessible_project",
            return_value=None,
        ),
        pytest.raises(InvalidHandoffContext),
    ):
        get_flow(HandoffFlow.ADD_FEATURE).render(context, user_id=1, organization_id=2)


def test_add_feature_context_serializer_validates_project_access() -> None:
    context_serializer = get_flow(HandoffFlow.ADD_FEATURE).get_context_serializer()
    assert context_serializer is not None
    serializer = context_serializer(
        data={"product": "tracing", "projectId": 99},
        context={"user_id": 1, "organization_id": 2},
    )
    with patch(
        "sentry.agent_handoff.flows.add_feature.get_accessible_project",
        return_value=RpcProject(id=99, slug="my-project", organization_id=2),
    ) as check:
        assert serializer.is_valid(), serializer.errors

    assert serializer.validated_data == AddFeatureContext(
        product=AddFeatureProduct.TRACING, project_id=99
    )
    check.assert_called_once_with(organization_id=2, user_id=1, project_id=99)

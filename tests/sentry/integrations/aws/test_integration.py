from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlsplit

import orjson
import pytest
from urllib3.exceptions import HTTPError

from sentry.integrations.aws.client import AwsVerification, verify_aws_connection
from sentry.integrations.aws.integration import (
    AwsConfigInputSerializer,
    AwsCustomerConfigApiStep,
    AwsIntegration,
    AwsIntegrationProvider,
    AwsSetupApiStep,
    AwsVerificationApiStep,
)
from sentry.integrations.aws.setup import PERMISSION_POLICY, terraform_config, trust_policy
from sentry.integrations.aws.utils import parse_regions, parse_role_arn
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.pipeline.types import PipelineStepAction
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test

ROLE_ARN = "arn:aws:iam::123456789012:role/SentrySeerAccess"
PRINCIPAL_ARN = "arn:aws:iam::111111111111:role/SentrySeerBroker"
EXTERNAL_ID = "a" * 64


def verification(**overrides: Any) -> dict[str, Any]:
    return {
        "connection_status": "connected",
        "external_id_required": True,
        "regions": [
            {
                "region": "us-east-1",
                "connection_status": "connected",
                "services": [
                    {"service": service, "status": "connected", "error_detail": None}
                    for service in ("sts", "logs", "cloudwatch", "xray")
                ],
                "error_detail": None,
            }
        ],
        "error_detail": None,
        **overrides,
    }


def make_pipeline(state: dict[str, Any]) -> Mock:
    pipeline = Mock(organization=Mock(id=1))
    pipeline.fetch_state.side_effect = state.get
    pipeline.bind_state.side_effect = state.__setitem__
    return pipeline


@control_silo_test
class AwsIntegrationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.provider = AwsIntegrationProvider()
        self.provider.pipeline = Mock(organization=Mock(id=self.organization.id))
        self.state = {
            "external_id": EXTERNAL_ID,
            "config": {"role_arn": ROLE_ARN, "regions": ["us-east-1"]},
            "verification": verification(),
        }

    def install(self) -> AwsIntegration:
        data = self.provider.build_integration(self.state)
        integration = self.create_integration(
            organization=self.organization,
            provider="aws",
            external_id=data["external_id"],
            metadata=data["metadata"],
            name=data["name"],
        )
        self.provider.post_install(integration, self.organization, extra=data["post_install_data"])
        installation = integration.get_installation(self.organization.id)
        assert isinstance(installation, AwsIntegration)
        return installation

    def test_setup_generates_read_only_id_and_reuses_it_on_refresh(self) -> None:
        state: dict[str, Any] = {}
        pipeline = make_pipeline(state)
        step = AwsSetupApiStep()
        with self.options(
            {
                "seer-aws.principal-arn": PRINCIPAL_ARN,
                "seer-aws.cloudformation-url": "https://example.com/template.json?version=1&key=value",
            }
        ):
            data = step.get_step_data(pipeline, Mock())
            refreshed = step.get_step_data(pipeline, Mock())
            second_install = step.get_step_data(make_pipeline({}), Mock())
        assert len(data["externalId"]) == 64
        assert data["externalId"] == state["external_id"] == refreshed["externalId"]
        assert second_install["externalId"] != data["externalId"]
        step.handle_post({"externalId": "customer-selected"}, pipeline, Mock())
        assert state["external_id"] == data["externalId"]
        url = urlsplit(data["cloudformationUrl"])
        params = parse_qs(url.fragment.split("?", 1)[1])
        assert params["templateURL"] == ["https://example.com/template.json?version=1&key=value"]
        assert params["param_ExternalId"] == [data["externalId"]]
        assert params["param_SentryPrincipalArn"] == [PRINCIPAL_ARN]

    def test_setup_requires_broker_configuration(self) -> None:
        with pytest.raises(IntegrationConfigurationError, match="not available"):
            AwsSetupApiStep().get_step_data(make_pipeline({}), Mock())

    def test_config_serializer_validates_and_deduplicates(self) -> None:
        serializer = AwsConfigInputSerializer(
            data={
                "roleArn": f" {ROLE_ARN} ",
                "regions": ["us-east-1", "us-west-2", "us-east-1"],
                "externalId": "customer-selected",
            }
        )
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data == {
            "role_arn": ROLE_ARN,
            "regions": ["us-east-1", "us-west-2"],
        }
        AwsCustomerConfigApiStep().handle_post(
            serializer.validated_data, make_pipeline(self.state), Mock()
        )
        assert self.state["verification"] is None
        assert self.state["external_id"] == EXTERNAL_ID

    def test_verification_is_server_side(self) -> None:
        self.state["verification"] = None
        pipeline = make_pipeline(self.state)
        step = AwsVerificationApiStep()
        assert (
            step.handle_post({"action": "finish"}, pipeline, Mock()).action
            == PipelineStepAction.ERROR
        )
        with patch(
            "sentry.integrations.aws.integration.verify_aws_connection",
            return_value=AwsVerification.parse_obj(verification()),
        ) as verify:
            result = step.handle_post({"action": "verify"}, pipeline, Mock())
        verify.assert_called_once_with(
            organization_id=1, role_arn=ROLE_ARN, external_id=EXTERNAL_ID, regions=["us-east-1"]
        )
        assert result.action == PipelineStepAction.STAY
        assert result.data["verification"]["externalIdRequired"] is True
        assert (
            step.handle_post({"action": "finish"}, pipeline, Mock()).action
            == PipelineStepAction.ADVANCE
        )

    def test_cannot_finish_when_external_id_is_not_required(self) -> None:
        self.state["verification"] = verification(external_id_required=False)
        result = AwsVerificationApiStep().handle_post(
            {"action": "finish"}, make_pipeline(self.state), Mock()
        )
        assert result.action == PipelineStepAction.ERROR
        with pytest.raises(IntegrationConfigurationError, match="Verify"):
            self.provider.build_integration(self.state)

    def test_failed_reverification_clears_previous_result(self) -> None:
        with patch(
            "sentry.integrations.aws.integration.verify_aws_connection",
            side_effect=IntegrationError("Unavailable"),
        ):
            result = AwsVerificationApiStep().handle_post(
                {"action": "verify"}, make_pipeline(self.state), Mock()
            )
        assert result.action == PipelineStepAction.ERROR
        assert self.state["verification"] is None

    def test_install_stores_org_scoped_config_and_read_only_fields(self) -> None:
        installation = self.install()
        config = installation.get_config_data()
        assert config["external_id"] == EXTERNAL_ID
        assert config["role_arn"] == ROLE_ARN
        assert config["aws_account_id"] == "123456789012"
        assert config["regions"] == ["us-east-1"]
        assert config["verification"] == verification()
        assert config["last_verified_at"]
        assert installation.model.metadata == {}
        fields = {field["name"]: field for field in installation.get_organization_config()}
        assert fields["external_id"]["disabled"]
        assert fields["sentry_principal_arn"]["disabled"]

    def test_same_account_in_two_orgs_has_distinct_database_identity(self) -> None:
        first = self.provider.build_integration(self.state)
        other_org = self.create_organization()
        self.provider.pipeline = Mock(organization=Mock(id=other_org.id))
        second = self.provider.build_integration({**self.state, "external_id": "b" * 64})
        assert first["external_id"] != second["external_id"]
        assert (
            first["post_install_data"]["external_id"] != second["post_install_data"]["external_id"]
        )

    def test_cannot_replace_installed_account_external_id(self) -> None:
        self.install()
        with pytest.raises(IntegrationConfigurationError, match="already installed"):
            self.provider.build_integration({**self.state, "external_id": "b" * 64})

    def test_reinstall_after_uninstall_uses_new_external_id(self) -> None:
        installation = self.install()
        OrganizationIntegration.objects.get(id=installation.org_integration.id).delete()
        data = self.provider.build_integration({**self.state, "external_id": "b" * 64})
        assert data["post_install_data"]["external_id"] != EXTERNAL_ID

    def test_edits_ignore_read_only_data_and_verify_new_configuration(self) -> None:
        installation = self.install()
        new_arn = "arn:aws:iam::123456789012:role/SentrySeerNew"
        result = verification(external_id_required=False, connection_status="invalid_trust_policy")
        with patch(
            "sentry.integrations.aws.integration.verify_aws_connection",
            return_value=AwsVerification.parse_obj(result),
        ) as verify:
            installation.update_organization_config(
                {
                    "role_arn": new_arn,
                    "external_id": "customer-selected",
                    "aws_account_id": "999999999999",
                    "verification": verification(),
                }
            )
        verify.assert_called_once_with(
            organization_id=self.organization.id,
            role_arn=new_arn,
            external_id=EXTERNAL_ID,
            regions=["us-east-1"],
        )
        config = OrganizationIntegration.objects.get(id=installation.org_integration.id).config
        assert config["role_arn"] == new_arn
        assert config["external_id"] == EXTERNAL_ID
        assert config["aws_account_id"] == "123456789012"
        assert config["verification"] == result

    def test_cannot_move_external_id_to_another_account(self) -> None:
        installation = self.install()
        with pytest.raises(IntegrationConfigurationError, match="different AWS account"):
            installation.update_organization_config(
                {"role_arn": "arn:aws:iam::999999999999:role/SentrySeerAccess"}
            )

    def test_retest_uses_stored_config(self) -> None:
        installation = self.install()
        with patch(
            "sentry.integrations.aws.integration.verify_aws_connection",
            return_value=AwsVerification.parse_obj(verification()),
        ) as verify:
            installation.update_organization_config({})
        verify.assert_called_once_with(
            organization_id=self.organization.id,
            role_arn=ROLE_ARN,
            external_id=EXTERNAL_ID,
            regions=["us-east-1"],
        )


@pytest.mark.parametrize(
    "arn",
    [
        "arn:aws:iam::123456789012:root",
        "arn:aws:sts::123456789012:assumed-role/SentrySeerAccess/session",
        "arn:aws-cn:iam::123456789012:role/SentrySeerAccess",
        "arn:aws:iam::123:role/SentrySeerAccess",
        "arn:aws:iam::123456789012:role/",
        "arn:aws:iam::123456789012:role/a b",
        "arn:aws:iam::123456789012:role/" + "a" * 65,
        "arn:aws:iam::123456789012:role/" + "a" * 512 + "/role",
        None,
    ],
)
def test_role_arn_rejects_invalid_identity(arn: Any) -> None:
    with pytest.raises(IntegrationConfigurationError):
        parse_role_arn(arn)


def test_role_arn_accepts_path() -> None:
    assert (
        parse_role_arn(" arn:aws:iam::123456789012:role/service/SentrySeerAccess ")
        == "arn:aws:iam::123456789012:role/service/SentrySeerAccess"
    )


@pytest.mark.parametrize("regions", [[], "us-east-1", [None], ["us-gov-west-1"], ["us-unknown-1"]])
def test_regions_reject_invalid_values(regions: Any) -> None:
    with pytest.raises(IntegrationConfigurationError):
        parse_regions(regions)


def test_cloudformation_and_terraform_use_same_restricted_policies() -> None:
    template = orjson.loads(
        (Path(__file__).parents[4] / "src/sentry/integrations/aws/cloudformation.json").read_text()
    )
    role = template["Resources"]["SentrySeerRole"]["Properties"]
    assert role["Policies"][0]["PolicyDocument"] == PERMISSION_POLICY
    trust = role["AssumeRolePolicyDocument"]
    trust["Statement"][0]["Principal"]["AWS"] = PRINCIPAL_ARN
    trust["Statement"][0]["Condition"]["StringEquals"]["sts:ExternalId"] = EXTERNAL_ID
    assert trust == trust_policy(PRINCIPAL_ARN, EXTERNAL_ID)
    assert orjson.dumps(trust, option=orjson.OPT_INDENT_2).decode() in terraform_config(
        PRINCIPAL_ARN, EXTERNAL_ID
    )
    assert role["MaxSessionDuration"] == 3600


@patch("sentry.integrations.aws.client.make_signed_seer_api_request")
def test_verification_sends_org_and_server_generated_id(request: Mock) -> None:
    request.return_value = Mock(status=200, data=orjson.dumps(verification()))
    result = verify_aws_connection(
        organization_id=1, role_arn=ROLE_ARN, external_id=EXTERNAL_ID, regions=["us-east-1"]
    )
    assert result.can_connect
    assert request.call_args.args[1] == "/v1/monitoring-providers/aws/verify-connection"
    assert orjson.loads(request.call_args.kwargs["body"]) == {
        "organization_id": 1,
        "role_arn": ROLE_ARN,
        "external_id": EXTERNAL_ID,
        "regions": ["us-east-1"],
    }


@pytest.mark.parametrize(
    "payload",
    [
        b"not json",
        b"null",
        orjson.dumps({"connection_status": "connected", "regions": []}),
        orjson.dumps(verification(external_id_required="true")),
        orjson.dumps(verification(regions=[])),
        orjson.dumps(
            verification(
                regions=[{"region": "us-west-2", "connection_status": "connected", "services": []}]
            )
        ),
        orjson.dumps(verification(regions=verification()["regions"] * 2)),
    ],
)
@patch("sentry.integrations.aws.client.make_signed_seer_api_request")
def test_verification_rejects_malformed_or_mismatched_results(
    request: Mock, payload: bytes
) -> None:
    request.return_value = Mock(status=200, data=payload)
    with pytest.raises(IntegrationError, match="Could not verify"):
        verify_aws_connection(
            organization_id=1, role_arn=ROLE_ARN, external_id=EXTERNAL_ID, regions=["us-east-1"]
        )


@pytest.mark.parametrize("response", [Mock(status=503), HTTPError("timeout")])
@patch("sentry.integrations.aws.client.make_signed_seer_api_request")
def test_verification_handles_unavailable_seer(request: Mock, response: Any) -> None:
    request.side_effect = [response]
    with pytest.raises(IntegrationError, match="Could not verify"):
        verify_aws_connection(
            organization_id=1, role_arn=ROLE_ARN, external_id=EXTERNAL_ID, regions=["us-east-1"]
        )

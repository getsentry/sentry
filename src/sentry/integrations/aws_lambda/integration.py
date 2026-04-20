from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from botocore.exceptions import ClientError
from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.fields import CharField, ChoiceField, IntegerField, ListField

from sentry import analytics, options
from sentry.analytics.events.integration_serverless_setup import IntegrationServerlessSetup
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import ServerlessMixin
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.silo.base import control_silo_function
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.sdk import capture_exception

from .client import ConfigurationError, gen_aws_client
from .utils import (
    ALL_AWS_REGIONS,
    disable_single_lambda,
    enable_single_lambda,
    get_dsn_for_project,
    get_function_layer_arns,
    get_index_of_sentry_layer,
    get_latest_layer_for_function,
    get_latest_layer_version,
    get_sentry_err_message,
    get_supported_functions,
    get_version_of_arn,
    wrap_lambda_updater,
)

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise

logger = logging.getLogger("sentry.integrations.aws_lambda")

DESCRIPTION = """
The AWS Lambda integration will automatically instrument your Lambda functions without any code changes. We use a CloudFormation Stack ([learn more about CloudFormation](https://aws.amazon.com/cloudformation/)) to create a Sentry role and enable error and transaction capture from your Lambda functions.
"""


FEATURES = [
    FeatureDescription(
        """
        Instrument your serverless code automatically.
        """,
        IntegrationFeatures.SERVERLESS,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=AWS%20Lambda%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/aws_lambda",
    aspects={},
)


class AwsLambdaIntegration(IntegrationInstallation, ServerlessMixin):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._client = None

    @property
    def region(self):
        return self.metadata["region"]

    @property
    def client(self):
        if not self._client:
            region = self.metadata["region"]
            account_number = self.metadata["account_number"]
            aws_external_id = self.metadata["aws_external_id"]
            self._client = gen_aws_client(
                account_number=account_number,
                region=region,
                aws_external_id=aws_external_id,
            )

        return self._client

    def get_client(self) -> Any:
        return self.client

    def get_one_lambda_function(self, name):
        # https://boto3.amazonaws.com/v1/documentation/api/1.22.12/reference/services/lambda.html
        return self.client.get_function(FunctionName=name)["Configuration"]

    def get_serialized_lambda_function(self, name):
        function = self.get_one_lambda_function(name)
        return self.serialize_lambda_function(function)

    def serialize_lambda_function(self, function):
        layers = get_function_layer_arns(function)
        layer_arn = get_latest_layer_for_function(function)
        function_runtime = function["Runtime"]

        # find our sentry layer
        sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)

        if sentry_layer_index > -1:
            sentry_layer = layers[sentry_layer_index]

            # determine the version and if it's out of date
            latest_version = get_latest_layer_version(function)
            current_version = get_version_of_arn(sentry_layer)
            out_of_date = latest_version > current_version

            if function_runtime.startswith("python"):
                # If env variable "SENTRY_INITIAL_HANDLER" is not present, then
                # it is should be assumed that this function is not enabled!
                env_variables = function.get("Environment", {}).get("Variables", {})
                if "SENTRY_INITIAL_HANDLER" not in env_variables:
                    current_version = -1
                    out_of_date = False
        else:
            current_version = -1
            out_of_date = False

        return {
            "name": function["FunctionName"],
            "runtime": function_runtime,
            "version": current_version,
            "outOfDate": out_of_date,
            "enabled": current_version > -1,
        }

    # ServerlessMixin interface
    def get_serverless_functions(self):
        """
        Returns a list of serverless functions
        """
        functions = get_supported_functions(self.client)
        functions.sort(key=lambda x: x["FunctionName"].lower())

        return [self.serialize_lambda_function(function) for function in functions]

    @wrap_lambda_updater()
    def enable_function(self, target):
        function = self.get_one_lambda_function(target)
        config_data = self.get_config_data()
        project_id = config_data["default_project_id"]

        sentry_project_dsn = get_dsn_for_project(self.organization_id, project_id)

        enable_single_lambda(self.client, function, sentry_project_dsn)

        return self.get_serialized_lambda_function(target)

    @wrap_lambda_updater()
    def disable_function(self, target):
        function = self.get_one_lambda_function(target)
        layer_arn = get_latest_layer_for_function(function)

        disable_single_lambda(self.client, function, layer_arn)

        return self.get_serialized_lambda_function(target)

    @wrap_lambda_updater()
    def update_function_to_latest_version(self, target):
        function = self.get_one_lambda_function(target)
        layer_arn = get_latest_layer_for_function(function)

        layers = get_function_layer_arns(function)

        # update our layer if we find it
        sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)
        if sentry_layer_index > -1:
            layers[sentry_layer_index] = layer_arn

        self.client.update_function_configuration(
            FunctionName=target,
            Layers=layers,
        )
        return self.get_serialized_lambda_function(target)


class ProjectSelectSerializer(CamelSnakeSerializer):
    project_id = IntegerField(required=True)


class ProjectSelectApiStep:
    step_name = "project_select"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return ProjectSelectSerializer

    def handle_post(
        self,
        validated_data: dict[str, Any],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        project_id = validated_data["project_id"]

        assert pipeline.organization is not None
        valid_project_ids = {p.id for p in pipeline.organization.projects}
        if project_id not in valid_project_ids:
            return PipelineStepResult.error("Invalid project")

        pipeline.bind_state("project_id", project_id)
        return PipelineStepResult.advance()


class CloudFormationSerializer(CamelSnakeSerializer):
    account_number = CharField(required=True)
    region = ChoiceField(choices=[(r, r) for r in ALL_AWS_REGIONS], required=True)
    aws_external_id = CharField(required=True)

    def validate_account_number(self, value: str) -> str:
        if not value.isdigit() or len(value) != 12:
            raise serializers.ValidationError("Must be a 12-digit AWS account number")
        return value


class CloudFormationApiStep:
    step_name = "cloudformation"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        template_url = options.get("aws-lambda.cloudformation-url")
        return {
            "baseCloudformationUrl": "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review",
            "templateUrl": template_url,
            "stackName": "Sentry-Monitoring-Stack",
            "regionList": ALL_AWS_REGIONS,
        }

    def get_serializer_cls(self) -> type:
        return CloudFormationSerializer

    def handle_post(
        self,
        validated_data: dict[str, Any],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        account_number = validated_data["account_number"]
        region = validated_data["region"]
        aws_external_id = validated_data["aws_external_id"]

        pipeline.bind_state("account_number", account_number)
        pipeline.bind_state("region", region)
        pipeline.bind_state("aws_external_id", aws_external_id)

        try:
            gen_aws_client(account_number, region, aws_external_id)
        except ClientError:
            return PipelineStepResult.error(
                "Please validate the Cloudformation stack was created successfully"
            )
        except ConfigurationError:
            raise
        except Exception as e:
            logger.warning(
                "CloudFormationApiStep.unexpected_error",
                extra={"error": str(e)},
            )
            return PipelineStepResult.error("Unknown error")

        return PipelineStepResult.advance()


class FunctionSelectSerializer(CamelSnakeSerializer):
    enabled_functions = ListField(child=CharField(), required=True)


class InstrumentationApiStep:
    step_name = "instrumentation"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        account_number = pipeline.fetch_state("account_number")
        region = pipeline.fetch_state("region")
        aws_external_id = pipeline.fetch_state("aws_external_id")

        lambda_client = gen_aws_client(account_number, region, aws_external_id)
        lambda_functions = get_supported_functions(lambda_client)
        lambda_functions.sort(key=lambda x: x["FunctionName"].lower())

        return {
            "functions": [
                {
                    "name": fn["FunctionName"],
                    "runtime": fn["Runtime"],
                    "description": fn.get("Description", ""),
                }
                for fn in lambda_functions
            ]
        }

    def get_serializer_cls(self) -> type:
        return FunctionSelectSerializer

    def handle_post(
        self,
        validated_data: dict[str, Any],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        assert pipeline.organization is not None
        organization = pipeline.organization

        account_number = pipeline.fetch_state("account_number")
        region = pipeline.fetch_state("region")
        project_id = pipeline.fetch_state("project_id")
        aws_external_id = pipeline.fetch_state("aws_external_id")

        enabled_functions = validated_data["enabled_functions"]
        enabled_lambdas = {name: True for name in enabled_functions}

        sentry_project_dsn = get_dsn_for_project(organization.id, project_id)

        lambda_client = gen_aws_client(account_number, region, aws_external_id)
        lambda_functions = get_supported_functions(lambda_client)
        lambda_functions.sort(key=lambda x: x["FunctionName"].lower())

        lambda_functions = [
            fn for fn in lambda_functions if enabled_lambdas.get(fn["FunctionName"])
        ]

        def _enable_lambda(function):
            try:
                enable_single_lambda(lambda_client, function, sentry_project_dsn)
                return (True, function, None)
            except Exception as e:
                return (False, function, e)

        failures: list[dict[str, Any]] = []
        success_count = 0

        with ContextPropagatingThreadPoolExecutor(
            max_workers=options.get("aws-lambda.thread-count")
        ) as _lambda_setup_thread_pool:
            for success, function, e in _lambda_setup_thread_pool.map(
                _enable_lambda, lambda_functions
            ):
                name = function["FunctionName"]
                if success:
                    success_count += 1
                else:
                    err_message: str | _StrPromise = str(e)
                    is_custom_err, err_message = get_sentry_err_message(err_message)
                    if not is_custom_err:
                        capture_exception(e)
                        err_message = _("Unknown Error")
                    failures.append({"name": name, "error": str(err_message)})
                    logger.info(
                        "update_function_configuration.error",
                        extra={
                            "organization_id": organization.id,
                            "lambda_name": name,
                            "account_number": account_number,
                            "region": region,
                            "error": str(e),
                        },
                    )

        analytics.record(
            IntegrationServerlessSetup(
                user_id=request.user.id,
                organization_id=organization.id,
                integration="aws_lambda",
                success_count=success_count,
                failure_count=len(failures),
            )
        )

        if failures:
            return PipelineStepResult.stay(
                data={
                    "failures": failures,
                    "successCount": success_count,
                }
            )

        return PipelineStepResult.advance()


class AwsLambdaIntegrationProvider(IntegrationProvider):
    key = "aws_lambda"
    name = "AWS Lambda"
    metadata = metadata
    integration_cls = AwsLambdaIntegration
    features = frozenset([IntegrationFeatures.SERVERLESS])

    def get_pipeline_views(self) -> list:
        return []

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [
            ProjectSelectApiStep(),
            CloudFormationApiStep(),
            InstrumentationApiStep(),
        ]

    @control_silo_function
    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        region = state["region"]
        account_number = state["account_number"]
        aws_external_id = state["aws_external_id"]

        org_client = gen_aws_client(
            account_number, region, aws_external_id, service_name="organizations"
        )
        try:
            account = org_client.describe_account(AccountId=account_number)["Account"]
            account_name = account["Name"]
            integration_name = f"{account_name} {region}"
        except (
            org_client.exceptions.AccessDeniedException,
            org_client.exceptions.AWSOrganizationsNotInUseException,
        ):
            # if the customer won't let us access the org name, use the account
            # number instead we can also get a different error for self-hosted
            # users setting up the integration on an account that doesn't have
            # an organization
            integration_name = f"{account_number} {region}"

        external_id = f"{account_number}-{region}"

        return {
            "name": integration_name,
            "external_id": external_id,
            "metadata": {
                "account_number": account_number,
                "region": region,
                "aws_external_id": aws_external_id,
            },
            "post_install_data": {"default_project_id": state["project_id"]},
        }

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        default_project_id = extra["default_project_id"]
        for oi in OrganizationIntegration.objects.filter(
            organization_id=organization.id, integration=integration
        ):
            oi.update(config={"default_project_id": default_project_id})

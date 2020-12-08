from __future__ import absolute_import

import logging
import six
import uuid

from django.utils.translation import ugettext_lazy as _


from sentry import options
from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.models import Project, ProjectKey
from sentry.pipeline import PipelineView
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.web.helpers import render_to_response
from sentry.utils.compat import filter

from .client import gen_aws_lambda_client
from .utils import parse_arn

logger = logging.getLogger("sentry.integrations.aws_lambda")

DESCRIPTION = """
The AWS Lambda integration will automatically instrument your Lambda functions without any code changes. All you need to do is run a CloudFormation stack that we provide to get started.
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
    issue_url="https://github.com/getsentry/sentry/issues/new",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/aws_lambda",
    aspects={},
)

SUPPORTED_RUNTIMES = ["nodejs12.x", "nodejs10.x"]


class AwsLambdaIntegration(IntegrationInstallation):
    pass


class AwsLambdaIntegrationProvider(IntegrationProvider):
    key = "aws_lambda"
    name = "AWS Lambda"
    requires_feature_flag = True
    metadata = metadata
    integration_cls = AwsLambdaIntegration
    features = frozenset([IntegrationFeatures.SERVERLESS])

    def get_pipeline_views(self):
        return [AwsLambdaCloudFormationPipelineView(), AwsLambdaSetupLayerPipelineView()]

    def build_integration(self, state):
        # TODO: unhardcode
        integration_name = "Serverless Hack Bootstrap"

        arn = state["arn"]
        parsed_arn = parse_arn(arn)
        account_id = parsed_arn["account"]
        region = parsed_arn["region"]

        external_id = u"{}-{}".format(account_id, region)

        integration = {
            "name": integration_name,
            "external_id": external_id,
            "metadata": {"arn": state["arn"], "aws_external_id": state["aws_external_id"]},
        }
        return integration


class AwsLambdaCloudFormationPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        # TODO: Find way so a user/org only gets one external id
        if request.method == "POST":
            arn = request.POST["arn"]
            aws_external_id = request.POST["aws_external_id"]
            pipeline.bind_state("arn", arn)
            pipeline.bind_state("aws_external_id", aws_external_id)
            return pipeline.next_step()

        template_url = options.get("aws-lambda.cloudformation-url")
        aws_external_id = uuid.uuid4()

        cloudformation_url = (
            "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?"
            "stackName=Sentry-Monitoring-Stack-Filter&templateURL=%s&param_ExternalId=%s"
            % (template_url, aws_external_id)
        )

        return render_to_response(
            template="sentry/integrations/aws-lambda-cloudformation.html",
            request=request,
            context={"cloudformation_url": cloudformation_url, "aws_external_id": aws_external_id},
        )


class AwsLambdaSetupLayerPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        organization = pipeline.organization

        # TODO: make project selection part of flow
        project = Project.objects.filter(
            organization=organization, platform="node-awslambda"
        ).first()
        if not project:
            raise IntegrationError("No valid project")

        enabled_dsn = ProjectKey.get_default(project=project)
        if not enabled_dsn:
            raise IntegrationError("Project does not have DSN enabled")
        sentry_project_dsn = enabled_dsn.get_dsn(public=True)

        arn = pipeline.fetch_state("arn")
        aws_external_id = pipeline.fetch_state("aws_external_id")

        lambda_client = gen_aws_lambda_client(arn, aws_external_id)

        lambda_functions = filter(
            lambda x: x.get("Runtime") in SUPPORTED_RUNTIMES,
            lambda_client.list_functions()["Functions"],
        )

        for function in lambda_functions:
            name = function["FunctionName"]
            # TODO: load existing layers and environment and append to them
            try:
                lambda_client.update_function_configuration(
                    FunctionName=name,
                    Layers=[options.get("aws-lambda.node-layer-arn")],
                    Environment={
                        "Variables": {
                            "NODE_OPTIONS": "-r @sentry/serverless/dist/auto",
                            "SENTRY_DSN": sentry_project_dsn,
                            "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                        }
                    },
                )
            except Exception as e:
                logger.info(
                    "update_function_configuration.error",
                    extra={
                        "organization_id": organization.id,
                        "lambda_name": name,
                        "arn": arn,
                        "error": six.text_type(e),
                    },
                )

        return pipeline.next_step()

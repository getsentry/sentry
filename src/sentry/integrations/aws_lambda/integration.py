from __future__ import absolute_import

import boto3
import logging
import uuid
import os

from botocore.config import Config
from django.utils.translation import ugettext_lazy as _


from sentry import options
from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.pipeline import PipelineView
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.web.helpers import render_to_response
from sentry.utils.http import absolute_uri
from sentry.utils.compat import filter

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

# Taken from: https://gist.github.com/gene1wood/5299969edc4ef21d8efcfea52158dd40
def parse_arn(arn):
    # http://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html
    elements = arn.split(":", 5)
    result = {
        "arn": elements[0],
        "partition": elements[1],
        "service": elements[2],
        "region": elements[3],
        "account": elements[4],
        "resource": elements[5],
        "resource_type": None,
    }
    if "/" in result["resource"]:
        result["resource_type"], result["resource"] = result["resource"].split("/", 1)
    elif ":" in result["resource"]:
        result["resource_type"], result["resource"] = result["resource"].split(":", 1)
    return result


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
        return [AwsLambdaPipelineView(), SetupSubscriptionView()]

    def build_integration(self, state):
        # TODO: unhardcode
        integration_name = "Serverless Hack Bootstrap"

        arn = state["arn"]
        parsed_arn = parse_arn(arn)
        account_id = parsed_arn["account"]

        integration = {
            "name": integration_name,
            "external_id": account_id,  # we might want the region as part of the external id
            "metadata": {"arn": state["arn"]},
        }
        return integration


class AwsLambdaPipelineView(PipelineView):
    def dispatch(self, request, pipeline):

        if request.method == "POST":
            arn = request.POST["arn"]
            external_id = request.POST["external_id"]
            pipeline.bind_state("arn", arn)
            pipeline.bind_state("external_id", external_id)
            return pipeline.next_step()

        template_url = options.get("aws-lambda.cloudformation-url")
        external_id = uuid.uuid4()
        external_id = "cef3b0f5-49be-4cc9-a786-15c62695fd2a"
        cloudformation_url = (
            "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?"
            "stackName=Sentry-Monitoring-Stack-Filter&templateURL=%s&param_ExternalId=%s"
            % (template_url, external_id)
        )

        return render_to_response(
            template="sentry/integrations/aws-lambda-cloudformation.html",
            request=request,
            context={"cloudformation_url": cloudformation_url, "external_id": external_id},
        )



class SetupSubscriptionView(PipelineView):
    def dispatch(self, request, pipeline):
        arn = pipeline.fetch_state("arn")

        external_id = pipeline.fetch_state("external_id")

        parsed_arn = parse_arn(arn)
        account_id = parsed_arn["account"]
        region = parsed_arn["region"]

        role_arn = "arn:aws:iam::%s:role/SentryRole"%(account_id)

        # this needs to either be done in a loop or in the SNS callback
        client = boto3.client(
            service_name="sts",
            aws_access_key_id=options.get("aws-lambda.access-key-id"),
            aws_secret_access_key=options.get("aws-lambda.secret-access-key"),
            region_name=options.get("aws-lambda.region"),
        )

        assumed_role_object = client.assume_role(
            RoleSessionName="MySession", RoleArn=role_arn, ExternalId=external_id
        )

        credentials = assumed_role_object["Credentials"]

        tmp_access_key = credentials['AccessKeyId']
        tmp_secret_key = credentials['SecretAccessKey']
        security_token = credentials['SessionToken']

        boto3_session = boto3.Session(
            aws_access_key_id=tmp_access_key,
            aws_secret_access_key=tmp_secret_key, aws_session_token=security_token
        )

        lambda_client = boto3_session.client(service_name='lambda', region_name=region)
        log_client = boto3_session.client(service_name='logs', region_name=region)
        iam_client = boto3_session.client(service_name='iam', region_name=region)

        lambda_functions = filter(lambda x: x.get("Runtime") in SUPPORTED_RUNTIMES, lambda_client.list_functions()["Functions"])


        for function in lambda_functions:
            name = function["FunctionName"]
            lambda_client.update_function_configuration(FunctionName=name, Layers=[options.get("aws-lambda.node-layer-arn")])

        return pipeline.next_step()

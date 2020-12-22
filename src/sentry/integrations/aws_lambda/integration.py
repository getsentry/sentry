from __future__ import absolute_import

import logging
import six
import uuid

from django.utils.translation import ugettext_lazy as _


from sentry import options
from sentry.api.serializers import serialize
from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.integrations.serverless import ServerlessMixin
from sentry.models import Project, ProjectKey
from sentry.pipeline import PipelineView
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.web.helpers import render_to_response
from sentry.utils.compat import map
from sentry.utils import json

from .client import gen_aws_client
from .utils import (
    parse_arn,
    get_index_of_sentry_layer,
    get_aws_node_arn,
    get_version_of_arn,
    get_supported_functions,
)

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


class AwsLambdaIntegration(IntegrationInstallation, ServerlessMixin):
    def get_client(self):
        arn = self.metadata["arn"]
        aws_external_id = self.metadata["aws_external_id"]
        return gen_aws_client(arn, aws_external_id)

    def get_serverless_functions(self):
        """
        Returns a list of serverless functions
        """
        client = self.get_client()
        functions = get_supported_functions(client)

        return map(self.map_lambda_function, functions)

    def map_lambda_function(self, function):
        layers = function.get("Layers", [])
        region = parse_arn(self.metadata["arn"])["region"]

        node_layer_arn = get_aws_node_arn(region)

        # find our sentry layer
        sentry_layer_index = get_index_of_sentry_layer(layers, node_layer_arn)

        if sentry_layer_index > -1:
            sentry_layer = layers[sentry_layer_index]

            # determine the version and if it's out of date
            latest_version = int(options.get("aws-lambda.node-layer-version"))
            current_version = get_version_of_arn(sentry_layer["Arn"])
            out_of_date = latest_version > current_version
        else:
            current_version = -1
            out_of_date = False

        return {
            "name": function["FunctionName"],
            "runtime": function["Runtime"],
            "version": current_version,
            "outOfDate": out_of_date,
            "enabled": current_version > -1,  # TODO: check env variables
        }


class AwsLambdaIntegrationProvider(IntegrationProvider):
    key = "aws_lambda"
    name = "AWS Lambda"
    requires_feature_flag = True
    metadata = metadata
    integration_cls = AwsLambdaIntegration
    features = frozenset([IntegrationFeatures.SERVERLESS])

    def get_pipeline_views(self):
        return [
            AwsLambdaProjectSelectPipelineView(),
            AwsLambdaCloudFormationPipelineView(),
            AwsLambdaListFunctionsPipelineView(),
            AwsLambdaSetupLayerPipelineView(),
        ]

    def build_integration(self, state):
        arn = state["arn"]
        aws_external_id = state["aws_external_id"]

        parsed_arn = parse_arn(arn)
        account_id = parsed_arn["account"]
        region = parsed_arn["region"]

        org_client = gen_aws_client(arn, aws_external_id, service_name="organizations")
        account = org_client.describe_account(AccountId=account_id)["Account"]

        integration_name = u"{} {}".format(account["Name"], region)

        external_id = u"{}-{}".format(account_id, region)

        integration = {
            "name": integration_name,
            "external_id": external_id,
            "metadata": {"arn": arn, "aws_external_id": aws_external_id},
        }
        return integration


class AwsLambdaProjectSelectPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        # if we have the project_id, go to the next step
        if "project_id" in request.GET:
            return pipeline.next_step()

        organization = pipeline.organization
        # TODO: check status of project
        projects = Project.objects.filter(organization=organization).order_by("id")
        serialized_projects = map(lambda x: serialize(x, request.user), projects)

        return self.render_react_view(
            request, "awsLambdaProjectSelect", {"projects": serialized_projects}
        )


class AwsLambdaCloudFormationPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        if request.method == "POST":
            # load parameters from query param and post request
            project_id = request.GET["project_id"]
            arn = request.POST["arn"]
            aws_external_id = request.POST["aws_external_id"]

            pipeline.bind_state("arn", arn)
            pipeline.bind_state("aws_external_id", aws_external_id)
            pipeline.bind_state("project_id", project_id)
            return pipeline.next_step()

        template_url = options.get("aws-lambda.cloudformation-url")

        # let browser set external id from local storage so restarting
        # the installation maintains the same external id
        aws_external_id = request.GET.get("aws_external_id", uuid.uuid4())

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


class AwsLambdaListFunctionsPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        # the previous pipeline step will have be POST and will reach this line here
        # we need to check our state to determine what to do
        if request.method == "POST" and pipeline.fetch_state("ready_for_enabled_lambdas_post"):
            # accept form data or json data
            data = request.POST or json.loads(request.body)
            pipeline.bind_state("enabled_lambdas", data)
            return pipeline.next_step()

        # bind the state now so we are ready to accept the enabled_lambdas in the post pdy
        pipeline.bind_state("ready_for_enabled_lambdas_post", True)

        arn = pipeline.fetch_state("arn")
        aws_external_id = pipeline.fetch_state("aws_external_id")

        lambda_client = gen_aws_client(arn, aws_external_id)

        lambda_functions = get_supported_functions(lambda_client)

        return self.render_react_view(
            request, "awsLambdaFunctionSelect", {"lambdaFunctions": lambda_functions}
        )


class AwsLambdaSetupLayerPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        if "finish_pipeline" in request.GET:
            return pipeline.finish_pipeline()

        organization = pipeline.organization

        arn = pipeline.fetch_state("arn")
        region = parse_arn(arn)["region"]
        # the layer ARN has to be located within a specific region
        node_layer_arn = get_aws_node_arn(region)

        project_id = pipeline.fetch_state("project_id")
        aws_external_id = pipeline.fetch_state("aws_external_id")
        enabled_lambdas = pipeline.fetch_state("enabled_lambdas")

        try:
            project = Project.objects.get(organization=organization, id=project_id)
        except Project.DoesNotExist:
            raise IntegrationError("No valid project")

        enabled_dsn = ProjectKey.get_default(project=project)
        if not enabled_dsn:
            raise IntegrationError("Project does not have DSN enabled")
        sentry_project_dsn = enabled_dsn.get_dsn(public=True)

        lambda_client = gen_aws_client(arn, aws_external_id)

        lambda_functions = get_supported_functions(lambda_client)
        lambda_functions.sort(key=lambda x: x["FunctionName"].lower())

        failures = []

        for function in lambda_functions:
            name = function["FunctionName"]
            # check to see if the user wants to enable this function
            if not enabled_lambdas.get(name):
                continue
            try:
                # update the env variables
                env_variables = function.get("Environment", {}).get("Variables", {})
                env_variables.update(
                    {
                        "NODE_OPTIONS": "-r @sentry/serverless/dist/auto",
                        "SENTRY_DSN": sentry_project_dsn,
                        "SENTRY_TRACES_SAMPLE_RATE": "1.0",
                    }
                )

                # find the sentry layer and update it or insert new layer to end
                layers = function.get("Layers", [])
                sentry_layer_index = get_index_of_sentry_layer(layers, node_layer_arn)
                if sentry_layer_index > -1:
                    layers[sentry_layer_index] = node_layer_arn
                else:
                    layers.append(node_layer_arn)

                lambda_client.update_function_configuration(
                    FunctionName=name, Layers=layers, Environment={"Variables": env_variables},
                )
            except Exception as e:
                failures.append(function)
                logger.info(
                    "update_function_configuration.error",
                    extra={
                        "organization_id": organization.id,
                        "lambda_name": name,
                        "arn": arn,
                        "error": six.text_type(e),
                    },
                )

        # if we have failures, show them to the user
        # otherwise, finish
        if failures:
            return self.render_react_view(
                request, "awsLambdaFailureDetails", {"lambdaFunctionFailures": failures}
            )
        else:
            return pipeline.finish_pipeline()

from __future__ import absolute_import

import logging
import six

from botocore.exceptions import ClientError
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
from sentry.models import Project, OrganizationIntegration, ProjectStatus
from sentry.pipeline import PipelineView
from sentry.utils.compat import map
from sentry.utils import json

from .client import gen_aws_client
from .utils import (
    parse_arn,
    get_index_of_sentry_layer,
    get_version_of_arn,
    get_supported_functions,
    get_latest_layer_version,
    get_latest_layer_for_function,
    get_function_layer_arns,
    enable_single_lambda,
    disable_single_lambda,
    get_dsn_for_project,
    check_arn_is_valid_cloudformation_stack,
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
    def __init__(self, *args, **kwargs):
        super(AwsLambdaIntegration, self).__init__(*args, **kwargs)
        self._client = None

    @property
    def region(self):
        return parse_arn(self.metadata["arn"])["region"]

    @property
    def client(self):
        if not self._client:
            arn = self.metadata["arn"]
            aws_external_id = self.metadata["aws_external_id"]
            self._client = gen_aws_client(arn, aws_external_id)
        return self._client

    def get_one_lambda_function(self, name):
        return self.client.get_function(FunctionName=name)["Configuration"]

    def get_serialized_lambda_function(self, name):
        function = self.get_one_lambda_function(name)
        return self.serialize_lambda_function(function)

    def serialize_lambda_function(self, function):
        layers = get_function_layer_arns(function)
        layer_arn = get_latest_layer_for_function(function)

        # find our sentry layer
        sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)

        if sentry_layer_index > -1:
            sentry_layer = layers[sentry_layer_index]

            # determine the version and if it's out of date
            latest_version = get_latest_layer_version(function["Runtime"])
            current_version = get_version_of_arn(sentry_layer)
            out_of_date = latest_version > current_version
        else:
            current_version = -1
            out_of_date = False

        return {
            "name": function["FunctionName"],
            "runtime": function["Runtime"],
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

        return map(self.serialize_lambda_function, functions)

    def enable_function(self, target):
        function = self.get_one_lambda_function(target)
        layer_arn = get_latest_layer_for_function(function)

        config_data = self.get_config_data()
        project_id = config_data["default_project_id"]

        sentry_project_dsn = get_dsn_for_project(self.organization_id, project_id)

        enable_single_lambda(self.client, function, sentry_project_dsn, layer_arn)

        return self.get_serialized_lambda_function(target)

    def disable_function(self, target):
        function = self.get_one_lambda_function(target)
        layer_arn = get_latest_layer_for_function(function)

        disable_single_lambda(self.client, function, layer_arn)

        return self.get_serialized_lambda_function(target)

    def update_function_to_latest_version(self, target):
        function = self.get_one_lambda_function(target)
        layer_arn = get_latest_layer_for_function(function)

        layers = get_function_layer_arns(function)

        # update our layer if we find it
        sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)
        if sentry_layer_index > -1:
            layers[sentry_layer_index] = layer_arn

        self.client.update_function_configuration(
            FunctionName=target, Layers=layers,
        )
        return self.get_serialized_lambda_function(target)


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
            "post_install_data": {"default_project_id": state["project_id"]},
        }
        return integration

    def post_install(self, integration, organization, extra):
        default_project_id = extra["default_project_id"]
        OrganizationIntegration.objects.filter(
            organization=organization, integration=integration
        ).update(config={"default_project_id": default_project_id})


class AwsLambdaProjectSelectPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        # if we have the projectId, go to the next step
        if "projectId" in request.GET:
            pipeline.bind_state("project_id", request.GET["projectId"])
            return pipeline.next_step()

        organization = pipeline.organization
        projects = Project.objects.filter(
            organization=organization, status=ProjectStatus.VISIBLE
        ).order_by("id")

        # if only one project, automatically use that
        if len(projects) == 1:
            pipeline.bind_state("project_id", projects[0].id)
            return pipeline.next_step()

        serialized_projects = map(lambda x: serialize(x, request.user), projects)
        return self.render_react_view(
            request, "awsLambdaProjectSelect", {"projects": serialized_projects}
        )


class AwsLambdaCloudFormationPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        def render_response(error=None):
            template_url = options.get("aws-lambda.cloudformation-url")
            context = {
                "baseCloudformationUrl": "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review",
                "templateUrl": template_url,
                "stackName": "Sentry-Monitoring-Stack-Filter",
                "arn": pipeline.fetch_state("arn"),
                "error": error,
            }
            return self.render_react_view(request, "awsLambdaCloudformation", context)

        # form submit adds arn to GET parameters
        if "arn" in request.GET:
            data = request.GET

            # load parameters post request
            arn = data["arn"]
            aws_external_id = data["awsExternalId"]

            pipeline.bind_state("arn", arn)
            pipeline.bind_state("aws_external_id", aws_external_id)

            if not check_arn_is_valid_cloudformation_stack(arn):
                return render_response(_("Invalid ARN"))

            # now validate the arn works
            try:
                gen_aws_client(arn, aws_external_id)
            except ClientError:
                return render_response(
                    _("Please validate the Cloudformation stack was created successfully")
                )
            except Exception as e:
                logger.error(
                    "AwsLambdaCloudFormationPipelineView.unexpected_error",
                    extra={"error": six.text_type(e)},
                )
                return render_response(_("Unkown errror"))

            # if no error, continue
            return pipeline.next_step()

        return render_response()


class AwsLambdaListFunctionsPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        if request.method == "POST":
            # accept form data or json data
            data = request.POST or json.loads(request.body)
            pipeline.bind_state("enabled_lambdas", data)
            return pipeline.next_step()

        arn = pipeline.fetch_state("arn")
        aws_external_id = pipeline.fetch_state("aws_external_id")

        lambda_client = gen_aws_client(arn, aws_external_id)

        lambda_functions = get_supported_functions(lambda_client)

        return self.render_react_view(
            request, "awsLambdaFunctionSelect", {"lambdaFunctions": lambda_functions},
        )


class AwsLambdaSetupLayerPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        if "finish_pipeline" in request.GET:
            return pipeline.finish_pipeline()

        organization = pipeline.organization

        arn = pipeline.fetch_state("arn")

        project_id = pipeline.fetch_state("project_id")
        aws_external_id = pipeline.fetch_state("aws_external_id")
        enabled_lambdas = pipeline.fetch_state("enabled_lambdas")

        sentry_project_dsn = get_dsn_for_project(organization.id, project_id)

        lambda_client = gen_aws_client(arn, aws_external_id)

        lambda_functions = get_supported_functions(lambda_client)
        lambda_functions.sort(key=lambda x: x["FunctionName"].lower())

        failures = []

        for function in lambda_functions:
            name = function["FunctionName"]
            # check to see if the user wants to enable this function
            if not enabled_lambdas.get(name):
                continue

            # find the latest layer for this function
            layer_arn = get_latest_layer_for_function(function)
            try:
                enable_single_lambda(lambda_client, function, sentry_project_dsn, layer_arn)
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

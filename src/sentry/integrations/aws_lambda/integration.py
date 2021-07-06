import logging
from concurrent.futures import ThreadPoolExecutor

from botocore.exceptions import ClientError
from django.utils.translation import ugettext_lazy as _

from sentry import analytics, options
from sentry.api.serializers import serialize
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.serverless import ServerlessMixin
from sentry.models import OrganizationIntegration, Project, ProjectStatus
from sentry.pipeline import PipelineView
from sentry.utils import json
from sentry.utils.compat import map
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

logger = logging.getLogger("sentry.integrations.aws_lambda")

DESCRIPTION = """
The AWS Lambda integration will automatically instrument your Lambda functions without any code changes. We use CloudFormation Stack ([Learn more about CloudFormation](https://aws.amazon.com/cloudformation/)) to create Sentry role and enable errors and transactions capture from your Lambda functions.
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
            self._client = gen_aws_client(account_number, region, aws_external_id)
        return self._client

    def get_one_lambda_function(self, name):
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

        return map(self.serialize_lambda_function, functions)

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


class AwsLambdaIntegrationProvider(IntegrationProvider):
    key = "aws_lambda"
    name = "AWS Lambda"
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
            # if the customer won't let us access the org name, use the account number instead
            # we can also get a different error for on-prem users setting up the integration
            # on an account that doesn't have an organization
            integration_name = f"{account_number} {region}"

        external_id = f"{account_number}-{region}"

        integration = {
            "name": integration_name,
            "external_id": external_id,
            "metadata": {
                "account_number": account_number,
                "region": region,
                "aws_external_id": aws_external_id,
            },
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
        ).order_by("slug")

        # if only one project, automatically use that
        if len(projects) == 1:
            pipeline.bind_state("skipped_project_select", True)
            pipeline.bind_state("project_id", projects[0].id)
            return pipeline.next_step()

        serialized_projects = map(lambda x: serialize(x, request.user), projects)
        return self.render_react_view(
            request, "awsLambdaProjectSelect", {"projects": serialized_projects}
        )


class AwsLambdaCloudFormationPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        curr_step = 0 if pipeline.fetch_state("skipped_project_select") else 1

        def render_response(error=None):
            serialized_organization = serialize(pipeline.organization, request.user)
            template_url = options.get("aws-lambda.cloudformation-url")
            context = {
                "baseCloudformationUrl": "https://console.aws.amazon.com/cloudformation/home#/stacks/create/review",
                "templateUrl": template_url,
                "stackName": "Sentry-Monitoring-Stack",
                "regionList": ALL_AWS_REGIONS,
                "accountNumber": pipeline.fetch_state("account_number"),
                "region": pipeline.fetch_state("region"),
                "error": error,
                "initialStepNumber": curr_step,
                "organization": serialized_organization,
                "awsExternalId": pipeline.fetch_state("aws_external_id"),
            }
            return self.render_react_view(request, "awsLambdaCloudformation", context)

        # form submit adds accountNumber to GET parameters
        if "accountNumber" in request.GET:
            data = request.GET

            # load parameters post request
            account_number = data["accountNumber"]
            region = data["region"]
            aws_external_id = data["awsExternalId"]

            pipeline.bind_state("account_number", account_number)
            pipeline.bind_state("region", region)
            pipeline.bind_state("aws_external_id", aws_external_id)

            # now validate the arn works
            try:
                gen_aws_client(account_number, region, aws_external_id)
            except ClientError:
                return render_response(
                    _("Please validate the Cloudformation stack was created successfully")
                )
            except ConfigurationError:
                # if we have a configuration error, we should blow up the pipeline
                raise
            except Exception as e:
                logger.error(
                    "AwsLambdaCloudFormationPipelineView.unexpected_error",
                    extra={"error": str(e)},
                )
                return render_response(_("Unknown error"))

            # if no error, continue
            return pipeline.next_step()

        return render_response()


class AwsLambdaListFunctionsPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        if request.method == "POST":
            # accept form data or json data
            # form data is needed for tests
            data = request.POST or json.loads(request.body)
            pipeline.bind_state("enabled_lambdas", data)
            return pipeline.next_step()

        account_number = pipeline.fetch_state("account_number")
        region = pipeline.fetch_state("region")
        aws_external_id = pipeline.fetch_state("aws_external_id")

        lambda_client = gen_aws_client(account_number, region, aws_external_id)

        lambda_functions = get_supported_functions(lambda_client)

        curr_step = 2 if pipeline.fetch_state("skipped_project_select") else 3

        return self.render_react_view(
            request,
            "awsLambdaFunctionSelect",
            {"lambdaFunctions": lambda_functions, "initialStepNumber": curr_step},
        )


class AwsLambdaSetupLayerPipelineView(PipelineView):
    def dispatch(self, request, pipeline):
        if "finish_pipeline" in request.GET:
            return pipeline.finish_pipeline()

        organization = pipeline.organization

        account_number = pipeline.fetch_state("account_number")
        region = pipeline.fetch_state("region")

        project_id = pipeline.fetch_state("project_id")
        aws_external_id = pipeline.fetch_state("aws_external_id")
        enabled_lambdas = pipeline.fetch_state("enabled_lambdas")

        sentry_project_dsn = get_dsn_for_project(organization.id, project_id)

        lambda_client = gen_aws_client(account_number, region, aws_external_id)

        lambda_functions = get_supported_functions(lambda_client)
        lambda_functions.sort(key=lambda x: x["FunctionName"].lower())

        def is_lambda_enabled(function):
            name = function["FunctionName"]
            # check to see if the user wants to enable this function
            return enabled_lambdas.get(name)

        lambda_functions = filter(is_lambda_enabled, lambda_functions)

        def _enable_lambda(function):
            try:
                enable_single_lambda(lambda_client, function, sentry_project_dsn)
                return (True, function, None)
            except Exception as e:
                return (False, function, e)

        failures = []
        success_count = 0

        with ThreadPoolExecutor(max_workers=10) as _lambda_setup_thread_pool:
            # use threading here to parallelize requests
            # no timeout on the thread since the underlying request will time out
            # if it takes too long
            for success, function, e in _lambda_setup_thread_pool.map(
                _enable_lambda, lambda_functions
            ):
                name = function["FunctionName"]
                if success:
                    success_count += 1
                else:
                    # need to make sure we catch any error to continue to the next function
                    err_message = str(e)
                    is_custom_err, err_message = get_sentry_err_message(err_message)
                    if not is_custom_err:
                        capture_exception(e)
                        err_message = _("Unknown Error")
                    failures.append({"name": function["FunctionName"], "error": err_message})
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
            "integrations.serverless_setup",
            user_id=request.user.id,
            organization_id=organization.id,
            integration="aws_lambda",
            success_count=success_count,
            failure_count=len(failures),
        )

        # if we have failures, show them to the user
        # otherwise, finish

        if failures:
            return self.render_react_view(
                request,
                "awsLambdaFailureDetails",
                {"lambdaFunctionFailures": failures, "successCount": success_count},
            )
        else:
            return pipeline.finish_pipeline()

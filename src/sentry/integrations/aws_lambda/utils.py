import re
import six

from django.utils.translation import ugettext_lazy as _
from functools import wraps

from sentry import options

from sentry.models import Project, ProjectKey
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.compat import filter, map

SUPPORTED_RUNTIMES = ["nodejs12.x", "nodejs10.x"]

INVALID_LAYER_TEXT = "Invalid existing layer %s"

DEFAULT_NUM_RETRIES = 3

ALL_AWS_REGIONS = [
    "us-east-1",
    "us-east-2",
    "us-west-1",
    "us-west-2",
    "ap-south-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "ap-northeast-1",
    "ap-northeast-2",
    "ca-central-1",
    "eu-central-1",
    "eu-west-1",
    "eu-west-2",
    "eu-west-3",
    "sa-east-1",
]


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


def _get_aws_node_arn(region):
    return "arn:aws:lambda:{}:{}:layer:{}:{}".format(
        region,
        options.get("aws-lambda.account-number"),
        options.get("aws-lambda.node.layer-name"),
        options.get("aws-lambda.node.layer-version"),
    )


def _get_arn_without_version(arn):
    return arn.rpartition(":")[0]


def get_version_of_arn(arn):
    return int(arn.split(":")[-1])


def _get_arn_from_layer(layer):
    # layer could be a string or dict
    if isinstance(layer, dict):
        return layer["Arn"]
    return layer


def get_function_layer_arns(function):
    layers = function.get("Layers", [])
    return map(_get_arn_from_layer, layers)


def get_latest_layer_for_function(function):
    region = parse_arn(function["FunctionArn"])["region"]
    runtime = function["Runtime"]
    if runtime.startswith("nodejs"):
        return _get_aws_node_arn(region)
    # update when we can handle other runtimes like Python
    raise Exception("Unsupported runtime")


def get_latest_layer_version(runtime):
    if runtime.startswith("nodejs"):
        return int(options.get("aws-lambda.node.layer-version"))
    # update when we can handle other runtimes like Python
    raise Exception("Unsupported runtime")


def get_index_of_sentry_layer(layers, arn_to_match):
    """
    Find the index of the Sentry layer in a list of layers.
    If the version is different, we still consider that a match

    :param layers: list of layer
    :return: index of layer or -1 if no match
    """
    target_arn_no_version = _get_arn_without_version(arn_to_match)
    for i, layer_arn in enumerate(layers):
        local_arn_without_version = _get_arn_without_version(layer_arn)
        if local_arn_without_version == target_arn_no_version:
            return i
    return -1


def get_supported_functions(lambda_client):
    paginator = lambda_client.get_paginator("list_functions")
    response_iterator = paginator.paginate()
    functions = []
    for page in response_iterator:
        functions += page["Functions"]

    return filter(
        lambda x: x.get("Runtime") in SUPPORTED_RUNTIMES,
        functions,
    )


def get_dsn_for_project(organization_id, project_id):
    try:
        project = Project.objects.get(organization_id=organization_id, id=project_id)
    except Project.DoesNotExist:
        raise IntegrationError("No valid project")

    enabled_dsn = ProjectKey.get_default(project=project)
    if not enabled_dsn:
        raise IntegrationError("Project does not have DSN enabled")
    return enabled_dsn.get_dsn(public=True)


def enable_single_lambda(lambda_client, function, sentry_project_dsn, layer_arn, retries_left=3):
    name = function["FunctionName"]
    # update the env variables
    env_variables = function.get("Environment", {}).get("Variables", {})
    env_variables.update(
        {
            "NODE_OPTIONS": "-r @sentry/serverless/dist/awslambda-auto",
            "SENTRY_DSN": sentry_project_dsn,
            "SENTRY_TRACES_SAMPLE_RATE": "1.0",
        }
    )
    # find the sentry layer and update it or insert new layer to end
    layers = get_function_layer_arns(function)
    sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)
    if sentry_layer_index > -1:
        layers[sentry_layer_index] = layer_arn
    else:
        layers.append(layer_arn)

    return update_lambda_with_retries(
        lambda_client, FunctionName=name, Layers=layers, Environment={"Variables": env_variables}
    )


def disable_single_lambda(lambda_client, function, layer_arn):
    name = function["FunctionName"]
    layers = get_function_layer_arns(function)
    env_variables = function.get("Environment", {}).get("Variables", {})

    # find our sentry layer
    sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)
    if sentry_layer_index > -1:
        layers.pop(sentry_layer_index)

    # remove our env variables
    for env_name in ["NODE_OPTIONS", "SENTRY_DSN", "SENTRY_TRACES_SAMPLE_RATE"]:
        if env_name in env_variables:
            del env_variables[env_name]

    return update_lambda_with_retries(
        lambda_client,
        FunctionName=name,
        Layers=layers,
        Environment={"Variables": env_variables},
    )


def update_lambda_with_retries(lambda_client, **kwargs):
    num_retries = DEFAULT_NUM_RETRIES
    # pull off the num_retries argument if it exists
    if "num_retries" in kwargs:
        num_retries = kwargs.pop("num_retries")
    try:
        return lambda_client.update_function_configuration(**kwargs)
    except lambda_client.exceptions.ResourceConflictException:
        # if we get a ResourceConflictException, we should attempt to retry the operation
        # until num_retries is 0
        if num_retries > 0:
            kwargs["num_retries"] = num_retries - 1
            return update_lambda_with_retries(lambda_client, **kwargs)
        raise


def get_invalid_layer_name(err_message):
    """
    Check to see if an error matches the invalid layer message
    :param err_message: error string
    :return the layer name if it's a invalid layer
    """
    match = re.search(
        r"Layer version arn:aws:lambda:[^:]+:\d+:layer:([^:]+):\d+ does not exist",
        err_message,
    )
    if match:
        return match[1]
    return None


def wrap_lambda_updater():
    """
    Wraps any function that updates a layer
    Throws an IntegrationError for specific known errors
    """

    def inner(func):
        @wraps(func)
        def wrapped(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                err_message = six.text_type(e)
                invalid_layer = get_invalid_layer_name(err_message)
                # only have one specific error to catch
                if invalid_layer:
                    raise IntegrationError(_(INVALID_LAYER_TEXT) % invalid_layer)
                # otherwise, re-raise the original error
                raise

        return wrapped

    return inner

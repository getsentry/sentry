import re
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.utils.translation import ugettext_lazy as _

from sentry import options
from sentry.models import Project, ProjectKey
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.tasks.release_registry import LAYER_INDEX_CACHE_KEY
from sentry.utils.compat import filter, map

SUPPORTED_RUNTIMES = [
    "nodejs14.x",
    "nodejs12.x",
    "nodejs10.x",
    "python2.7",
    "python3.6",
    "python3.7",
    "python3.8",
]

INVALID_LAYER_TEXT = "Invalid existing layer %s"
MISSING_ROLE_TEXT = "Invalid role associated with the lambda function"
TOO_MANY_REQUESTS_TEXT = "Something went wrong! Please enable function manually after installation"

DEFAULT_NUM_RETRIES = 3

OPTION_VERSION = "layer-version"
OPTION_LAYER_NAME = "layer-name"
OPTION_ACCOUNT_NUMBER = "account-number"

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


def get_option_value(function, option):
    region = parse_arn(function["FunctionArn"])["region"]
    runtime = function["Runtime"]

    # currently only supporting node runtimes
    if runtime.startswith("nodejs"):
        prefix = "node"
    elif runtime.startswith("python"):
        prefix = "python"
    else:
        raise Exception("Unsupported runtime")

    # account number doesn't depend on the runtime prefix
    if option == OPTION_ACCOUNT_NUMBER:
        option_field = "aws-lambda.account-number"
    else:
        option_field = f"aws-lambda.{prefix}.{option}"

    # if we don't have the settings set, read from our options
    if not settings.SENTRY_RELEASE_REGISTRY_BASEURL:
        return options.get(option_field)

    # otherwise, read from the cache
    cache_options = cache.get(LAYER_INDEX_CACHE_KEY) or {}
    key = f"aws-layer:{prefix}"
    cache_value = cache_options.get(key)

    if cache_value is None:
        raise IntegrationError(f"Could not find cache value with key {key}")

    # special lookup for the version since it depends on the region
    if option == OPTION_VERSION:
        region_release_list = cache_value.get("regions", [])
        matched_regions = filter(lambda x: x["region"] == region, region_release_list)
        # see if there is the specific region in our list
        if matched_regions:
            version = matched_regions[0]["version"]
            return version
        else:
            raise IntegrationError(f"Unsupported region {region}")

    # we use - in options but _ in the registry
    registry_field = option.replace("-", "_")

    # return the value out of the cache
    return cache_value.get(registry_field)


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
    return "arn:aws:lambda:{}:{}:layer:{}:{}".format(
        region,
        get_option_value(function, OPTION_ACCOUNT_NUMBER),
        get_option_value(function, OPTION_LAYER_NAME),
        get_option_value(function, OPTION_VERSION),
    )


def get_latest_layer_version(function):
    return int(get_option_value(function, OPTION_VERSION))


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


def enable_single_lambda(lambda_client, function, sentry_project_dsn, retries_left=3):
    # find the latest layer for this function
    layer_arn = get_latest_layer_for_function(function)

    name = function["FunctionName"]
    runtime = function["Runtime"]
    # update the env variables
    env_variables = function.get("Environment", {}).get("Variables", {})

    # Check if the sentry sdk layer already exists
    layers = get_function_layer_arns(function)
    sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)

    updated_handler = None

    sentry_env_variables = {
        "SENTRY_DSN": sentry_project_dsn,
        "SENTRY_TRACES_SAMPLE_RATE": "1.0",
    }

    if runtime.startswith("nodejs"):
        # note the env variables would be different for non-Node runtimes
        env_variables.update(
            {"NODE_OPTIONS": "-r @sentry/serverless/dist/awslambda-auto", **sentry_env_variables}
        )
    elif runtime.startswith("python"):
        # Check if we are trying to re-enable an already enabled python, and if
        # are we should not override the env variable "SENTRY_INITIAL_HANDLER"
        # because that would be problematic as we would lose the handler value.
        if sentry_layer_index > -1:
            env_variables.update(sentry_env_variables)
        else:
            env_variables.update(
                {"SENTRY_INITIAL_HANDLER": function["Handler"], **sentry_env_variables}
            )
        updated_handler = "sentry_sdk.integrations.init_serverless_sdk.sentry_lambda_handler"

    # Check if the sentry layer exists and update it or insert new layer to end
    if sentry_layer_index > -1:
        layers[sentry_layer_index] = layer_arn
    else:
        layers.append(layer_arn)

    lambda_kwargs = {
        "FunctionName": name,
        "Layers": layers,
        "Environment": {"Variables": env_variables},
    }
    if updated_handler:
        lambda_kwargs.update({"Handler": updated_handler})

    return update_lambda_with_retries(lambda_client, **lambda_kwargs)


def disable_single_lambda(lambda_client, function, layer_arn):
    name = function["FunctionName"]
    runtime = function["Runtime"]
    layers = get_function_layer_arns(function)
    env_variables = function.get("Environment", {}).get("Variables", {})

    # find our sentry layer
    sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)
    if sentry_layer_index > -1:
        layers.pop(sentry_layer_index)

    updated_handler = None

    if runtime.startswith("python"):
        updated_handler = env_variables["SENTRY_INITIAL_HANDLER"]

    for env_name in [
        "SENTRY_INITIAL_HANDLER",
        "NODE_OPTIONS",
        "SENTRY_DSN",
        "SENTRY_TRACES_SAMPLE_RATE",
    ]:
        if env_name in env_variables:
            del env_variables[env_name]

    lambda_kwargs = {
        "FunctionName": name,
        "Layers": layers,
        "Environment": {"Variables": env_variables},
    }
    if updated_handler:
        lambda_kwargs.update({"Handler": updated_handler})

    return update_lambda_with_retries(lambda_client, **lambda_kwargs)


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


def get_too_many_requests_error_message(err_message):
    """
    Check to see if an error is a TooManyRequestsException
    :param err_message: error string
    :return boolean value if the error matches the too many requests error
    """
    return "TooManyRequestsException" in err_message


def get_missing_role_error(err_message):
    """
    Check to see if an error matches the missing role text
    :param err_message: error string
    :return boolean value if the error matches the missing role text
    """
    missing_role_err = (
        "An error occurred (InvalidParameterValueException) when "
        "calling the UpdateFunctionConfiguration operation: "
        "The role defined for the function cannot be "
        "assumed by Lambda."
    )
    return err_message == missing_role_err


def get_sentry_err_message(err_message):
    """
    Check to see if an error matches a custom error and customizes the error
    message if it is a custom error
    :param err_message: error string
    :return tuple of boolean (True if message was customized) and err message
    """
    invalid_layer = get_invalid_layer_name(err_message)
    if invalid_layer:
        return True, (INVALID_LAYER_TEXT % invalid_layer)
    if get_missing_role_error(err_message):
        return True, MISSING_ROLE_TEXT
    if get_too_many_requests_error_message(err_message):
        return True, TOO_MANY_REQUESTS_TEXT
    return False, err_message


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
                err_message = str(e)
                is_custom_err, err_message = get_sentry_err_message(err_message)
                if is_custom_err:
                    raise IntegrationError(_(err_message))
                # otherwise, re-raise the original error
                raise

        return wrapped

    return inner

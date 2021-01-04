from __future__ import absolute_import

import six

from sentry import options

from sentry.models import Project, ProjectKey
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.compat import filter

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


def _get_aws_node_arn(region):
    return u"arn:aws:lambda:{}:{}:layer:{}:{}".format(
        region,
        options.get("aws-lambda.host-account-id"),
        options.get("aws-lambda.node-layer-name"),
        options.get("aws-lambda.node-layer-version"),
    )


def _get_arn_without_version(arn):
    return arn.rpartition(":")[0]


def get_version_of_arn(arn):
    return int(arn.split(":")[-1])


def get_latest_layer_for_function(function):
    region = parse_arn(function["FunctionArn"])["region"]
    runtime = function["Runtime"]
    if runtime.startswith("nodejs"):
        return _get_aws_node_arn(region)
    # update when we can handle other runtimes like Python
    raise Exception("Unsupported runtime")


def get_latest_layer_version(runtime):
    if runtime.startswith("nodejs"):
        return int(options.get("aws-lambda.node-layer-version"))
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
    for i, layer in enumerate(layers):
        # layer could be a string or dict
        if isinstance(layer, six.text_type):
            local_arn = layer
        else:
            local_arn = layer["Arn"]
        local_arn_without_version = _get_arn_without_version(local_arn)
        if local_arn_without_version == target_arn_no_version:
            return i
    return -1


def get_supported_functions(lambda_client):
    paginator = lambda_client.get_paginator("list_functions")
    response_iterator = paginator.paginate()
    functions = []
    for page in response_iterator:
        functions += page["Functions"]

    return filter(lambda x: x.get("Runtime") in SUPPORTED_RUNTIMES, functions,)


def get_dsn_for_project(organization_id, project_id):
    try:
        project = Project.objects.get(organization_id=organization_id, id=project_id)
    except Project.DoesNotExist:
        raise IntegrationError("No valid project")

    enabled_dsn = ProjectKey.get_default(project=project)
    if not enabled_dsn:
        raise IntegrationError("Project does not have DSN enabled")
    return enabled_dsn.get_dsn(public=True)


def enable_single_lambda(lambda_client, function, sentry_project_dsn, layer_arn):
    name = function["FunctionName"]
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
    sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)
    if sentry_layer_index > -1:
        layers[sentry_layer_index] = layer_arn
    else:
        layers.append(layer_arn)
    return lambda_client.update_function_configuration(
        FunctionName=name, Layers=layers, Environment={"Variables": env_variables},
    )


def disable_single_lambda(lambda_client, function, layer_arn):
    name = function["FunctionName"]
    layers = function.get("Layers", [])
    env_variables = function.get("Environment", {}).get("Variables", {})

    # find our sentry layer
    sentry_layer_index = get_index_of_sentry_layer(layers, layer_arn)
    if sentry_layer_index > -1:
        layers.pop(sentry_layer_index)

    # remove our env variables
    for env_name in ["NODE_OPTIONS", "SENTRY_DSN", "SENTRY_TRACES_SAMPLE_RATE"]:
        if env_name in env_variables:
            del env_variables[env_name]

    return lambda_client.update_function_configuration(
        FunctionName=name, Layers=layers, Environment={"Variables": env_variables},
    )

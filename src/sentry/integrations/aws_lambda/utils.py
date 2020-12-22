from __future__ import absolute_import

from sentry import options


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


def get_aws_node_arn(region):
    return u"arn:aws:lambda:{}:{}:layer:{}:{}".format(
        region,
        options.get("aws-lambda.host-account-id"),
        options.get("aws-lambda.node-layer-name"),
        options.get("aws-lambda.node-layer-version"),
    )


def get_arn_without_version(arn):
    return arn.rpartition(":")[0]


def get_index_of_sentry_layer(layers, arn_to_match):
    """
    Find the index of the Sentry layer in a list of layers.
    If the version is different, we still consider that a match

    :param layers: list of layer
    :return: index of layer or -1 if no match
    """
    target_arn_without_version = get_arn_without_version(arn_to_match)
    for i, layer in enumerate(layers):
        local_arn_without_version = get_arn_without_version(layer["Arn"])
        if local_arn_without_version == target_arn_without_version:
            return i
    return -1

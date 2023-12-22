__all__ = (
    "create_name_mapping_layers",
    "get_mri",
    "get_public_name_from_mri",
    "parse_expression",
    "get_operation_with_public_name",
)

from enum import Enum
from typing import Dict, Optional, Tuple, Union, cast

from sentry.exceptions import InvalidParams
from sentry.snuba.metrics.naming_layer.mri import (
    MRI_EXPRESSION_REGEX,
    MRI_SCHEMA_REGEX,
    ErrorsMRI,
    SessionMRI,
    SpanMRI,
    TransactionMRI,
)
from sentry.snuba.metrics.naming_layer.public import (
    ErrorsMetricKey,
    SessionMetricKey,
    SpanMetricKey,
    TransactionMetricKey,
)


def create_name_mapping_layers() -> None:
    # ToDo(ahmed): Hack this out once the FE changes their mappings
    # Backwards Compat
    NAME_TO_MRI.update(
        {
            # Session
            "sentry.sessions.session": SessionMRI.RAW_SESSION,
            "sentry.sessions.user": SessionMRI.RAW_USER,
            "sentry.sessions.session.duration": SessionMRI.RAW_DURATION,
            "sentry.sessions.session.error": SessionMRI.RAW_ERROR,
        }
    )

    for MetricKey, MRI in (
        (SessionMetricKey, SessionMRI),
        (TransactionMetricKey, TransactionMRI),
        (SpanMetricKey, SpanMRI),
        (ErrorsMetricKey, ErrorsMRI),
    ):
        # Adds new names at the end, so that when the reverse mapping is created
        for metric_key in MetricKey:
            NAME_TO_MRI[metric_key.value] = MRI[metric_key.name]

    MRI_TO_NAME.update({v.value: k for k, v in NAME_TO_MRI.items()})


NAME_TO_MRI: Dict[str, Enum] = {}
MRI_TO_NAME: Dict[str, str] = {}


def get_mri(external_name: Union[Enum, str]) -> str:
    if not len(NAME_TO_MRI):
        create_name_mapping_layers()

    if isinstance(external_name, Enum):
        external_name = external_name.value

    try:
        assert isinstance(external_name, str)
        return cast(str, NAME_TO_MRI[external_name].value)
    except KeyError:
        raise InvalidParams(
            f"Failed to parse '{external_name}'. The metric name must belong to a public metric."
        )


def get_public_name_from_mri(internal_name: Union[TransactionMRI, SessionMRI, str]) -> str:
    """
    Returns the public name from a MRI if it has a mapping to a public metric name, otherwise return the internal
    name.
    """
    if not len(MRI_TO_NAME):
        create_name_mapping_layers()

    if isinstance(internal_name, Enum):
        internal_name = internal_name.value
    assert isinstance(internal_name, str)

    if internal_name in MRI_TO_NAME:
        return MRI_TO_NAME[internal_name]
    elif (alias := _extract_name_from_custom_metric_mri(internal_name)) is not None:
        return alias
    else:
        return internal_name


def is_private_mri(internal_name: Union[TransactionMRI, SessionMRI, str]) -> bool:
    public_name = get_public_name_from_mri(internal_name)
    # If the public name is the same as internal name it means that the internal is "private".
    return public_name == internal_name


def _extract_name_from_custom_metric_mri(mri: str) -> Optional[str]:
    match = MRI_SCHEMA_REGEX.match(mri)
    if match is None:
        return None

    entity = match.group("entity")
    namespace = match.group("namespace")

    # Custom metrics are fully custom metrics that the sdks can emit.
    is_custom_metric = namespace == "custom"
    # Custom measurements are a special kind of custom metrics that are more limited and were existing
    # before fully custom metrics.
    is_custom_measurement = entity == "d" and namespace == "transactions"
    if is_custom_metric or is_custom_measurement:
        return match.group("name")

    return None


def get_operation_with_public_name(operation: Optional[str], metric_mri: str) -> str:
    return (
        f"{operation}({get_public_name_from_mri(metric_mri)})"
        if operation is not None
        else metric_mri
    )


def parse_expression(name: str) -> Tuple[Optional[str], str]:
    matches = MRI_EXPRESSION_REGEX.match(name)
    if matches:
        # operation, metric_mri
        return matches[1], matches[2]
    return None, name

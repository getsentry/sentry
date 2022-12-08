__all__ = (
    "create_name_mapping_layers",
    "get_mri",
    "get_public_name_from_mri",
    "parse_expression",
    "get_operation_with_public_name",
)


from enum import Enum
from typing import Dict, Optional, Tuple, Union, cast

from sentry.api.utils import InvalidParams
from sentry.snuba.metrics.naming_layer.mri import (
    MRI_EXPRESSION_REGEX,
    MRI_SCHEMA_REGEX,
    SessionMRI,
    TransactionMRI,
)
from sentry.snuba.metrics.naming_layer.public import SessionMetricKey, TransactionMetricKey


def create_name_mapping_layers() -> None:
    # ToDo(ahmed): Hack this out once the FE changes their mappings
    # Backwards Compat
    NAME_TO_MRI.update(
        {
            # Session
            "sentry.sessions.session": SessionMRI.SESSION,
            "sentry.sessions.user": SessionMRI.USER,
            "sentry.sessions.session.duration": SessionMRI.RAW_DURATION,
            "sentry.sessions.session.error": SessionMRI.ERROR,
        }
    )

    for (MetricKey, MRI) in (
        (SessionMetricKey, SessionMRI),
        (TransactionMetricKey, TransactionMRI),
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
    assert isinstance(external_name, str)

    try:
        return cast(str, NAME_TO_MRI[external_name].value)
    except KeyError:
        raise InvalidParams(
            f"Failed to parse '{external_name}'. Must be something like 'sum(my_metric)', "
            f"or a supported aggregate derived metric like `session.crash_free_rate`"
        )


def get_public_name_from_mri(internal_name: Union[TransactionMRI, SessionMRI, str]) -> str:
    """Returns the public name from a MRI if it has a mapping to a public metric name, otherwise raise an exception"""
    if not len(MRI_TO_NAME):
        create_name_mapping_layers()

    if isinstance(internal_name, Enum):
        internal_name = internal_name.value
    assert isinstance(internal_name, str)

    if internal_name in MRI_TO_NAME:
        return MRI_TO_NAME[internal_name]
    elif (alias := extract_custom_measurement_alias(internal_name)) is not None:
        return alias
    else:
        raise InvalidParams(f"Unable to find a mri reverse mapping for '{internal_name}'.")


def is_private_mri(internal_name: Union[TransactionMRI, SessionMRI, str]) -> bool:
    try:
        get_public_name_from_mri(internal_name)
        return False
    except InvalidParams:
        return True


def extract_custom_measurement_alias(internal_name: str) -> Optional[str]:
    match = MRI_SCHEMA_REGEX.match(internal_name)
    if (
        match is not None
        and match.group("entity") == "d"
        and match.group("namespace") == "transactions"
    ):
        return match.group("name")
    else:
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

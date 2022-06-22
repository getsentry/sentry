__all__ = ("create_name_mapping_layers", "get_mri", "get_public_name_from_mri")


from enum import Enum
from typing import Dict, Optional, Tuple, Union, cast

from sentry.api.utils import InvalidParams
from sentry.snuba.metrics.naming_layer.mri import MRI_EXPRESSION_REGEX, SessionMRI, TransactionMRI
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


def get_public_name_from_mri(
    internal_name: Union[TransactionMRI, SessionMRI, str]
) -> Optional[str]:
    """Returns the public name from a MRI if its a builtin metric, None otherwise"""
    if not len(MRI_TO_NAME):
        create_name_mapping_layers()

    if isinstance(internal_name, Enum):
        internal_name = internal_name.value
    assert isinstance(internal_name, str)

    return MRI_TO_NAME.get(internal_name)


def get_operation_with_public_name(operation: Optional[str], metric_mri: str) -> Optional[str]:
    if operation is None:
        return get_public_name_from_mri(metric_mri)
    return f"{operation}({get_public_name_from_mri(metric_mri)})"


def parse_expression(name: str) -> Tuple[Optional[str], str]:
    matches = MRI_EXPRESSION_REGEX.match(name)
    if matches:
        # operation, metric_mri
        return matches[1], matches[2]
    return None, name

__all__ = ("create_name_mapping_layers", "get_mri", "get_reverse_mri")


from enum import Enum
from typing import Dict, Union, cast

from sentry.snuba.metrics.naming_layer.mri import SessionMRI, TransactionMRI
from sentry.snuba.metrics.naming_layer.public import SessionMetricKey, TransactionMetricKey
from sentry.snuba.sessions_v2 import InvalidField


def create_name_mapping_layers() -> None:
    # ToDo(ahmed): Hack this out once the FE changes their mappings
    # Backwards Compat
    NAMING_MAPPING_LAYER.update(
        {
            # Session
            "sentry.sessions.session": SessionMRI.SESSION,
            "sentry.sessions.user": SessionMRI.USER,
            "sentry.sessions.session.duration": SessionMRI.RAW_DURATION,
            "sentry.sessions.session.error": SessionMRI.ERROR,
        }
    )

    for (MerticKey, MRI) in (
        (SessionMetricKey, SessionMRI),
        (TransactionMetricKey, TransactionMRI),
    ):
        # Adds new names at the end, so that when the reverse mapping is created
        for metric_key in MerticKey:
            try:
                NAMING_MAPPING_LAYER[metric_key.value] = MRI[metric_key.name]
            except KeyError:
                continue

    REVERSE_NAME_MAPPING_LAYER.update({v.value: k for k, v in NAMING_MAPPING_LAYER.items()})


NAMING_MAPPING_LAYER: Dict[str, Enum] = {}
REVERSE_NAME_MAPPING_LAYER: Dict[str, str] = {}


def get_mri(external_name: Union[Enum, str]) -> str:
    if not len(NAMING_MAPPING_LAYER):
        create_name_mapping_layers()

    if isinstance(external_name, Enum):
        external_name = external_name.value
    assert isinstance(external_name, str)

    try:
        return cast(str, NAMING_MAPPING_LAYER[external_name].value)
    except KeyError:
        raise InvalidField(
            f"Failed to parse '{external_name}'. Must be something like 'sum(my_metric)', "
            f"or a supported aggregate derived metric like `session.crash_free_rate"
        )


def get_reverse_mri(internal_name: Union[Enum, str]) -> str:
    if not len(REVERSE_NAME_MAPPING_LAYER):
        create_name_mapping_layers()

    if isinstance(internal_name, Enum):
        internal_name = internal_name.value
    assert isinstance(internal_name, str)

    try:
        return REVERSE_NAME_MAPPING_LAYER[internal_name]
    except KeyError:
        raise InvalidField(f"Unable to find a mri reverse mapping for '{internal_name}'.")

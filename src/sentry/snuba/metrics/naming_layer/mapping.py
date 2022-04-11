__all__ = ("create_name_mapping_layers", "get_mri", "get_public_name_from_mri")


from enum import Enum
from typing import Dict, Union, cast

from sentry.snuba.metrics.naming_layer.mri import SessionMRI, TransactionMRI
from sentry.snuba.metrics.naming_layer.public import SessionMetricKey, TransactionMetricKey
from sentry.snuba.sessions_v2 import InvalidField


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
        raise InvalidField(
            f"Failed to parse '{external_name}'. Must be something like 'sum(my_metric)', "
            f"or a supported aggregate derived metric like `session.crash_free_rate"
        )


def get_public_name_from_mri(internal_name: Union[TransactionMRI, SessionMRI, str]) -> str:
    if not len(MRI_TO_NAME):
        create_name_mapping_layers()

    if isinstance(internal_name, Enum):
        internal_name = internal_name.value
    assert isinstance(internal_name, str)

    try:
        return MRI_TO_NAME[internal_name]
    except KeyError:
        raise InvalidField(f"Unable to find a mri reverse mapping for '{internal_name}'.")

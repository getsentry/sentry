from __future__ import annotations

from sentry.snuba.metrics import get_mri
from sentry.snuba.metrics.naming_layer.mri import is_mri


def convert_metric_names_to_mris(metric_names: list[str]) -> list[str]:
    mris: list[str] = []
    for metric_name in metric_names or ():
        if is_mri(metric_name):
            mris.append(metric_name)
        else:
            mris.append(get_mri(metric_name))

    return mris

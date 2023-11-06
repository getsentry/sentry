import os
import sys

from django.conf import settings

from sentry.utils import json


def in_test_environment() -> bool:
    return "pytest" in sys.argv[0] or "vscode" in sys.argv[0]


def gcp_project_id() -> str:
    if in_test_environment():
        return "__test_gcp_project__"

    adc_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if adc_path:
        with open(adc_path) as fp:
            adc = json.load(fp)
            if adc.get("quota_project_id") is not None:
                return adc.get("quota_project_id")

    return "__unknown_gcp_project__"


def is_split_db() -> bool:
    if len(settings.DATABASES) != 1:  # type: ignore
        return True
    for db in settings.DATABASES.values():  # type: ignore
        if db["NAME"] in {"region", "control"}:
            return True
    return False

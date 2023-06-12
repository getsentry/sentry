from __future__ import annotations

import os
from copy import deepcopy
from typing import Any

from fixtures.integrations import FIXTURE_DIRECTORY
from sentry.utils import json


class StubService:
    """
    A stub is a service that replicates the functionality of a real software
    system by returning valid data without actually implementing any business
    logic. For example, a stubbed random dice_roll function might always return
    6. Stubs can make tests simpler and more reliable because they can replace
    flaky or slow networks call or allow you to have wider coverage in end-to-
    end tests.
    """

    stub_data_cache: dict[str, Any] = {}
    service_name: str

    @staticmethod
    def get_stub_json(service_name, name):
        """
        Get the stubbed data as a JSON string.

        :param service_name: string
        :param name: string
        :return: string
        """
        path = os.path.join(FIXTURE_DIRECTORY, service_name, "stubs", name)
        with open(path) as f:
            return f.read()

    @staticmethod
    def get_stub_data(service_name, name):
        """
        Get the stubbed data as a python object.

        :param service_name: string
        :param name: string
        :return: object
        """
        cache_key = f"{service_name}.{name}"
        cached = StubService.stub_data_cache.get(cache_key)
        if cached:
            data = cached
        else:
            data = json.loads(StubService.get_stub_json(service_name, name))
            StubService.stub_data_cache[cache_key] = data
        return deepcopy(data)

    def _get_stub_data(self, name):
        return StubService.get_stub_data(self.service_name, name)

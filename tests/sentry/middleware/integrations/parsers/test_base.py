from typing import Iterable
from unittest.mock import MagicMock, patch

from django.test import RequestFactory, override_settings
from pytest import raises

from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.silo.base import SiloLimit, SiloMode
from sentry.testutils import TestCase
from sentry.types.region import Region, RegionCategory


def error_regions(region: Region, invalid_region_names: Iterable[str]):
    if region.name in invalid_region_names:
        raise SiloLimit.AvailabilityError("Region is offline!")
    return region.name


class BaseRequestParserTest(TestCase):
    response_handler = MagicMock()
    region_config = (
        Region("na", 1, "https://na.testserver", RegionCategory.MULTI_TENANT),
        Region("eu", 2, "https://eu.testserver", RegionCategory.MULTI_TENANT),
    )
    factory = RequestFactory()

    def setUp(self):
        self.request = self.factory.get("/extensions/slack/webhook/")
        self.parser = BaseRequestParser(self.request, self.response_handler)

    @override_settings(SILO_MODE=SiloMode.MONOLITH)
    def test_fails_in_monolith_mode(self):
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_response_from_control_silo()
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_responses_from_region_silos(regions=self.region_config)

    @override_settings(SILO_MODE=SiloMode.REGION)
    def test_fails_in_region_mode(self):
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_response_from_control_silo()
        with raises(SiloLimit.AvailabilityError):
            self.parser.get_responses_from_region_silos(regions=self.region_config)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_get_response_from_control_silo(self):
        self.response_handler.reset_mock()
        response = self.parser.get_response_from_control_silo()
        assert self.response_handler.called
        assert response == self.response_handler(self.request)

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(BaseRequestParser, "_get_response_from_region_silo")
    def test_get_responses_from_region_silos(self, mock__get_response):
        mock__get_response.side_effect = lambda region: region.name

        response_map = self.parser.get_responses_from_region_silos(regions=self.region_config)
        assert mock__get_response.call_count == len(self.region_config)

        for region in self.region_config:
            assert response_map[region.name].response == region.name

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(BaseRequestParser, "_get_response_from_region_silo")
    def test_get_responses_from_region_silos_with_partial_failure(self, mock__get_response):
        mock__get_response.side_effect = lambda region: error_regions(region, ["eu"])

        response_map = self.parser.get_responses_from_region_silos(regions=self.region_config)
        assert mock__get_response.call_count == len(self.region_config)
        assert response_map["na"].response == "na"
        assert type(response_map["eu"].error) is SiloLimit.AvailabilityError

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @patch.object(BaseRequestParser, "_get_response_from_region_silo")
    def test_get_responses_from_region_silos_with_complete_failure(self, mock__get_response):
        mock__get_response.side_effect = lambda region: error_regions(region, ["na", "eu"])

        self.response_handler.reset_mock()
        response_map = self.parser.get_responses_from_region_silos(regions=self.region_config)
        assert mock__get_response.call_count == len(self.region_config)

        for region in self.region_config:
            assert type(response_map[region.name].error) is SiloLimit.AvailabilityError

import pytest

from sentry.lang.native.appconnect import NoDsymUrl
from sentry.utils.appleconnect import appstore_connect


class TestGetDsymUrl:
    def test_none_bundles(self) -> None:
        assert appstore_connect._get_dsym_url(None) is NoDsymUrl.NOT_NEEDED

    def test_empty_bundle_list(self) -> None:
        assert appstore_connect._get_dsym_url([]) is NoDsymUrl.NOT_NEEDED

    def test_one_bundle_strange_url(self) -> None:
        bundles = [
            {
                "type": "buildBundles",
                "id": "59467f37-371e-4755-afcd-0116775a6eab",
                "attributes": {
                    "dSYMUrl": 1,
                },
            }
        ]

        with pytest.raises(ValueError):
            appstore_connect._get_dsym_url(bundles)

    def test_one_bundle_no_url(self) -> None:
        bundles = [
            {
                "type": "buildBundles",
                "id": "59467f37-371e-4755-afcd-0116775a6eab",
                "attributes": {
                    "dSYMUrl": None,
                },
            }
        ]

        assert appstore_connect._get_dsym_url(bundles) is NoDsymUrl.NOT_NEEDED

    def test_one_bundle_has_url(self) -> None:
        url = "http://iosapps.itunes.apple.com/itunes-assets/very-real-url"
        bundles = [
            {
                "type": "buildBundles",
                "id": "59467f37-371e-4755-afcd-0116775a6eab",
                "attributes": {
                    "dSYMUrl": url,
                },
            }
        ]

        assert appstore_connect._get_dsym_url(bundles) == url

    def test_multi_bundle_no_url(self) -> None:
        bundles = [
            {
                "type": "buildBundles",
                "id": "59467f37-371e-4755-afcd-0116775a6eab",
                "attributes": {
                    "dSYMUrl": None,
                },
            },
            {
                "type": "buildBundles",
                "id": "5e231f58-31c6-47cc-b4f8-56952d44a158",
                "attributes": {
                    "dSYMUrl": None,
                },
            },
        ]

        assert appstore_connect._get_dsym_url(bundles) is NoDsymUrl.NOT_NEEDED

    def test_multi_bundle_has_url(self) -> None:
        first_url = "http://iosapps.itunes.apple.com/itunes-assets/very-real-url"
        second_url = "http://iosapps.itunes.apple.com/itunes-assets/very-fake-url"
        bundles = [
            {
                "type": "buildBundles",
                "id": "59467f37-371e-4755-afcd-0116775a6eab",
                "attributes": {
                    "dSYMUrl": first_url,
                },
            },
            {
                "type": "buildBundles",
                "id": "5e231f58-31c6-47cc-b4f8-56952d44a158",
                "attributes": {
                    "dSYMUrl": second_url,
                },
            },
        ]
        assert appstore_connect._get_dsym_url(bundles) is first_url

        bundles.reverse()
        assert appstore_connect._get_dsym_url(bundles) is second_url

    def test_multi_bundle_mixed_urls(self) -> None:
        url = "http://iosapps.itunes.apple.com/itunes-assets/very-real-url"
        bundles = [
            {
                "type": "buildBundles",
                "id": "59467f37-371e-4755-afcd-0116775a6eab",
                "attributes": {
                    "dSYMUrl": url,
                },
            },
            {
                "type": "buildBundles",
                "id": "5e231f58-31c6-47cc-b4f8-56952d44a158",
                "attributes": {
                    "dSYMUrl": None,
                },
            },
        ]

        assert appstore_connect._get_dsym_url(bundles) is url

        bundles.reverse()
        assert appstore_connect._get_dsym_url(bundles) is NoDsymUrl.NOT_NEEDED

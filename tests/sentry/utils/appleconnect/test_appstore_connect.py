"""Tests for using the App Store Connect API.

Some of these tests will try to use the live API requests if you provide a ``apikey.json``
file with credentials.  See the ``api_credentials`` fixture for details.
"""

import pathlib
import textwrap
import urllib.parse

import pytest
import requests
import responses as responses_mod

from sentry.lang.native.appconnect import NoDsymUrl
from sentry.utils import json
from sentry.utils.appleconnect import appstore_connect


class TestListBuilds:
    @pytest.fixture(scope="session", params=["live", "responses"])
    def api_credentials(self, request) -> appstore_connect.AppConnectCredentials:
        """An App Store Connect API key in the form of AppConnectCredentials.

        If ``apikey.json`` is present in the current directory it will load the credentials
        from this json for the ``live`` param, the format should look like this:

        ```json
            {
                "key_id": "AAAAAAAAAA",
                "issuer_id": "abcdef01-2345-6789-abcd-ef0123456789",
                "private_key": "-----BEGIN PRIVATE KEY-----\na_bunch_of_\n_separated_base64\n-----END PRIVATE KEY-----\n"
            }
        ```

        For the ``responses`` param a fake value is returned with a key_id="AAAAAAAAAA".
        """
        if request.param == "live":
            here = pathlib.Path(__file__).parent
            keyfile = here / "apikey.json"
            try:
                data = json.loads(keyfile.read_text(encoding="utf-8"))
            except FileNotFoundError:
                pytest.skip("No API key available for live tests")
            else:
                return appstore_connect.AppConnectCredentials(
                    key_id=data["key_id"], issuer_id=data["issuer_id"], key=data["private_key"]
                )
        else:
            # NOTE: This key has been generated for these test.
            return appstore_connect.AppConnectCredentials(
                key_id="AAAAAAAAAA",
                issuer_id="12345678-abcd-abcd-abcd-1234567890ab",
                key=(
                    textwrap.dedent(
                        """
                        -----BEGIN EC PRIVATE KEY-----
                        MHcCAQEEILd+RopXKDeu4wvj01ydqDp9goiI2KroiY4wgrMKz4j4oAoGCCqGSM49
                        AwEHoUQDQgAEe0GpznJGxz5cLukKBneiXlbPEEZRvqaKmpdd5Es+KQW0RK/9WmXK
                        J9b/VBtFOSMiVav8iev+Kr/xPqcoor6Mpw==
                        -----END EC PRIVATE KEY-----
                  """
                    )
                ),
            )

    @pytest.fixture(scope="session")
    def app_id(self) -> str:
        """The Sentry Cocoa Swift example app."""
        return "1549832463"

    def write_paged_build_response(self, api_credentials, app_id):
        """Use this function to create the ``pages_data.jons`` fixture data.

        NOTE: this function is purposefully dead code, it shows how to re-create the fixture
           data when it needs updating.

        The mocked_list_builds_api needs to load this data from a file, this can be used to
        generate the file.
        """
        session = requests.Session()
        url = (
            "v1/builds"
            f"?filter[app]={app_id}"
            "&limit=200"
            "&include=appStoreVersion,preReleaseVersion,buildBundles"
            "&limit[buildBundles]=50"
            "&sort=-uploadedDate"
            "&filter[processingState]=VALID"
        )
        pages = list(appstore_connect._get_appstore_info_paged(session, api_credentials, url))
        assert pages

        module_dir = pathlib.Path(__file__).parent
        pages_file = module_dir / "pages_data.json"
        pages_file.write_text(json.dumps(pages))

    @pytest.fixture
    def mocked_list_builds_api(self, api_credentials) -> responses_mod.RequestsMock:
        """Optionally mocks the App Store Connect list builds API.

        This fixture piggybacks on the ``api_credentials`` fixture's parametrisation and if
        it is the fake credentials it will mock out the responses to the list build URLs
        with our pre-configured data.  Otherwise it does nothing.
        """
        if api_credentials.key_id == "AAAAAAAAAA":
            here = pathlib.Path(__file__).parent
            saved_responses_filename = here / "pages_data.json"
            saved_pages = json.loads(saved_responses_filename.read_text())
            with responses_mod.RequestsMock() as r:
                for page in saved_pages:
                    r.add(
                        method="GET",
                        url=urllib.parse.unquote(page["links"]["self"]),
                        json=page,
                    )
                yield r
        else:
            yield None

    def test_get_build_info(self, mocked_list_builds_api, api_credentials, app_id):
        session = requests.Session()

        # Be sure to consume the entire ``builds`` iterator, otherwise the
        # responses.RequestsMock will be unhappy that not all calls were made.
        builds = list(
            appstore_connect.get_build_info(session, api_credentials, app_id, include_expired=True)
        )
        build = builds[0]

        assert build.app_id == app_id
        assert build.platform == "IOS"
        assert build.version
        assert build.build_number
        assert build.uploaded_date

    def test_dsyms_needed(self, mocked_list_builds_api, api_credentials, app_id):
        session = requests.Session()

        # Be sure to consume the entire ``builds`` iterator, otherwise the
        # responses.RequestsMock will be unhappy that not all calls were made.
        builds = list(
            appstore_connect.get_build_info(session, api_credentials, app_id, include_expired=True)
        )

        for build in builds:
            if build.build_number == "332":
                break
        else:
            pytest.fail("Build 332 not found")

        assert build.build_number == "332"
        assert build.dsym_url.startswith("http://iosapps.itunes.apple.com/itunes-assets/")
        assert "accessKey=" in build.dsym_url

    def test_no_dsyms_needed(self, mocked_list_builds_api, api_credentials, app_id):
        session = requests.Session()

        # Be sure to consume the entire ``builds`` iterator, otherwise the
        # responses.RequestsMock will be unhappy that not all calls were made.
        builds = list(
            appstore_connect.get_build_info(session, api_credentials, app_id, include_expired=True)
        )

        for build in builds:
            if build.build_number == "333":
                break
        else:
            pytest.fail("Build 333 not found")

        assert build.build_number == "333"
        assert build.dsym_url is appstore_connect.NoDsymUrl.NOT_NEEDED


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

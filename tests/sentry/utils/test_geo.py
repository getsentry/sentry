import importlib

from django.test.utils import override_settings

from sentry.testutils.factories import get_fixture_path


@override_settings(GEOIP_PATH_MMDB=get_fixture_path("test.mmdb"))
def test_geo_by_addr() -> None:
    import sentry.utils.geo

    importlib.reload(sentry.utils.geo)

    from sentry.utils.geo import geo_by_addr

    assert geo_by_addr("8.8.8.8") == {
        "country_code": "US",
        "region": "CA",
        "city": "Beverly Hills",
        "latitude": 34.09109878540039,
        "longitude": -118.41169738769531,
    }

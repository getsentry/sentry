from unittest import mock

import pytest
import responses

from sentry.uptime.rdap.query import (
    RDAP_BOOTSTRAP_REGSITRY,
    resolve_rdap_bootstrap_registry,
    resolve_rdap_network_details,
    resolve_rdap_provider,
)

SIMPLE_RDAP_BOOTSTRAP_RESPONSE = {
    "description": "Example RDAP bootstrap file for IPv4 address allocations",
    "publication": "2024-01-01T00:00:00Z",
    "services": [
        [
            [
                "1.0.0.0/8",
                "4.0.0.0/8",
            ],
            ["https://rdap.example.net/rdap/", "http://rdap.extra-example.net/rdap/"],
        ],
        [
            [
                "2.0.0.0/8",
                "5.0.0.0/8",
            ],
            ["https://rdap.other-example.net/"],
        ],
    ],
    "version": "1.0",
}

SIMPLE_RDAP_RESPONSE = {
    "handle": "NET-67-240-0-0-1",
    "startAddress": "67.240.0.0",
    "endAddress": "67.255.255.255",
    "ipVersion": "v4",
    "name": "RRNY",
    "type": "DIRECT ALLOCATION",
    "parentHandle": "NET-67-0-0-0-0",
    "events": [
        # Removed for brevity
    ],
    "links": [
        # Removed for brevity
    ],
    "entities": [
        {
            "handle": "CC-3517",
            "vcardArray": [
                "vcard",
                [
                    ["version", {}, "text", "4.0"],
                    ["fn", {}, "text", "Charter Communications Inc"],
                    [
                        "adr",
                        {"label": "6175 S. Willow Dr\nGreenwood Village\nCO\n80111\nUnited States"},
                        "text",
                        ["", "", "", "", "", "", ""],
                    ],
                    ["kind", {}, "text", "org"],
                ],
            ],
            "roles": ["registrant"],
            "remarks": [],
            "links": [
                # Removed for brevity
            ],
            "events": [
                # Removed for brevity
            ],
            "entities": [],
            "port43": "whois.arin.net",
            "objectClassName": "entity",
        }
    ],
    "port43": "whois.arin.net",
    "status": ["active"],
    "objectClassName": "ip network",
    "cidr0_cidrs": [{"v4prefix": "67.240.0.0", "length": 12}],
    "arin_originas0_originautnums": [],
}


@pytest.fixture(autouse=True)
def mocked_rdap_registry():
    with responses.mock:
        yield responses.add(
            "GET",
            RDAP_BOOTSTRAP_REGSITRY,
            json=SIMPLE_RDAP_BOOTSTRAP_RESPONSE,
        )


def test_resolve_rdap_bootstrap_registry(mocked_rdap_registry):
    assert resolve_rdap_bootstrap_registry() == SIMPLE_RDAP_BOOTSTRAP_RESPONSE["services"]
    assert mocked_rdap_registry.call_count == 1

    # Second call is cached, call count does not increase
    assert resolve_rdap_bootstrap_registry() == SIMPLE_RDAP_BOOTSTRAP_RESPONSE["services"]
    assert mocked_rdap_registry.call_count == 1


def test_resolve_rdap_provider(mocked_rdap_registry):
    assert resolve_rdap_provider("1.10.20.30") == "https://rdap.example.net/rdap/"
    assert resolve_rdap_provider("2.10.20.30") == "https://rdap.other-example.net/"
    assert resolve_rdap_provider("6.0.0.0") is None


@responses.activate
@mock.patch("sentry.uptime.rdap.query.resolve_hostname", return_value="1.0.0.0")
def test_resolve_rdap_network_details(mock_resolve_hostname):
    responses.add(
        "GET",
        "https://rdap.example.net/rdap/ip/1.0.0.0",
        json=SIMPLE_RDAP_RESPONSE,
    )
    details = resolve_rdap_network_details("abc.com")

    mock_resolve_hostname.assert_called_with("abc.com")
    assert details["handle"] == "CC-3517"
    assert details["owner_name"] == "Charter Communications Inc"

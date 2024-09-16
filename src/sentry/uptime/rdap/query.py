import ipaddress
import logging
from collections.abc import Mapping, MutableMapping, Sequence
from socket import gethostbyname
from typing import Any, TypedDict

import requests
from django.core.cache import cache

RDAP_BOOTSTRAP_REGSITRY = "https://data.iana.org/rdap/ipv4.json"
"""
JSON service registry maintained by the IANA containing a mapping of ipv4 CIDRs
to RDAP service urls.
"""

CIDRList = Sequence[str]
"""
List of CIDR addresses that a Regional Internet Registry is responsible for.
"""

RDAPServiceURLList = Sequence[str]
"""
List of Regional Internet Registry RDAP Service URLs for a CIDR set.
"""

ServiceArray = Sequence[tuple[CIDRList, RDAPServiceURLList]]

logger = logging.getLogger(__name__)

# Cache the RDAP boostrap file for a day
RDAP_BOOTSTRAP_JSON_CACHE_TIMEOUT = 60 * 60 * 24


class DomainAddressDetails(TypedDict):
    """
    This dictionary encapsulates the details of a rdap request that we care about
    """

    handle: str
    """
    A string representing an identifier assigned to the network registration by
    the registration holder.
    """

    owner_name: str | None
    """
    The human readible name of the owner of the network registration.
    """


def resolve_rdap_network_details(hostname: str) -> DomainAddressDetails:
    addr = resolve_hostname(hostname)
    rdap_provider_url = resolve_rdap_provider(addr)

    resp = requests.get(f"{rdap_provider_url}ip/{addr}")
    result: Mapping[str, Any] = resp.json()

    # We only extract details from the FIRST entity, there may be more with
    # other information about the network registration, but for now we're just
    # going to look at the first and assume it's the most relevant
    entity = result["entities"][0]

    jcard: Mapping[str, str] = {}
    if "vcardArray" in entity:
        jcard = parse_jcard_to_dict(entity["vcardArray"][1])

    details: DomainAddressDetails = {
        "handle": entity["handle"],
        "owner_name": jcard.get("fn"),
    }

    logger.info(
        "uptime.resolve_rdap_network_details",
        extra={
            "hostname": hostname,
            "resolved_addr": addr,
            "rdap_provider_url": rdap_provider_url,
            "details": details,
        },
    )

    return details


class RDAPBootstrapConfig(TypedDict):
    """
    Resulting structure of the RDAP_BOOTSTRAP_REGSITRY json file.
    """

    description: str
    publication: str
    services: ServiceArray
    version: str


def resolve_rdap_bootstrap_registry() -> ServiceArray:
    """
    Resolves the RDAP Bootstrap Registry JSON file. Caches the result for
    future calls.
    """
    cache_key = "uptime.rdap_bootstrap_registry_json"
    services: ServiceArray = cache.get(cache_key)

    if not services:
        # TODO(epurkhiser): Error handling for failing to get this bootstrap file
        config: RDAPBootstrapConfig = requests.get(RDAP_BOOTSTRAP_REGSITRY).json()
        services = config["services"]
        cache.set(cache_key, services, timeout=RDAP_BOOTSTRAP_JSON_CACHE_TIMEOUT)

    return services


def resolve_hostname(hostname: str) -> str:
    """
    Resolves a hostname to a ipv4 address.
    """
    return gethostbyname(hostname)


def resolve_rdap_provider(addr: str) -> str | None:
    """
    Given an ipv4 address, resolve the RDAP service API url for that address
    using the ICAN bootstrap file.
    """
    services = resolve_rdap_bootstrap_registry()
    ip_addr = ipaddress.ip_address(addr)

    service = next(
        (s for s in services if any(ip_addr in ipaddress.ip_network(cidr) for cidr in s[0])),
        None,
    )

    # IP Address could not be resolved to a RDAP service
    if service is None:
        logger.warning("uptime.no_rdap_provider_match", extra={"addr": addr})
        return None

    rdap_service_url = service[1][0]
    return rdap_service_url


def parse_jcard_to_dict(vcard: Sequence[tuple[str, Any, str, Any]]) -> Mapping[str, str]:
    """
    Converts a JSON jCard array into a dictionary.

    This currently ONLY translates `text` type fields into the dictionary
    mapping. See more about this format in the RFC [0].

    [0]: https://datatracker.ietf.org/doc/html/rfc7095
    """
    mapping: MutableMapping[str, str] = {}

    for items in vcard:
        name, property_type, values = items[0], items[2], items[3:]

        # Currently ignore anything that isn't `text`
        if property_type != "text":
            continue

        # Ignore text properties that have text values as lists. See Section
        # 3.3.1.3 [0] of the RFC for examples where this is the case.
        #
        # [0]: https://datatracker.ietf.org/doc/html/rfc7095#section-3.3.1.3
        if isinstance(values[0], list):
            continue

        # Join the values in case they are a list. See the RFC for more details
        mapping[name] = str(", ".join(values))

    return mapping

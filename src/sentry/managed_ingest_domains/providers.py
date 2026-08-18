from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, NotRequired, Protocol, TypedDict, cast
from urllib.parse import quote

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from sentry.shared_integrations.client.base import BaseApiClient
from sentry.shared_integrations.exceptions import ApiError

PROVIDER_ERROR_STATES = frozenset({"blocked", "deleted", "moved"})


class EdgeConfig(TypedDict):
    v: Literal[1]
    enabled: bool
    organization_id: str
    region: Literal["us"]
    projects: dict[str, list[str]]
    updated_at: str


@dataclass(frozen=True, slots=True)
class ProviderHostname:
    id: str
    hostname: str
    status: str | None
    certificate_status: str | None
    verification_errors: tuple[str, ...] = ()


class ManagedIngestProvider(Protocol):
    cname_target: str

    @property
    def name(self) -> Literal["fake", "cloudflare"]: ...

    def create_hostname(self, hostname: str) -> ProviderHostname: ...

    def get_hostname(self, provider_hostname_id: str) -> ProviderHostname: ...

    def refresh_hostname(self, provider_hostname_id: str) -> ProviderHostname: ...

    def delete_hostname(self, provider_hostname_id: str) -> None: ...

    def put_edge_config(self, hostname: str, config: EdgeConfig) -> None: ...

    def delete_edge_config(self, hostname: str) -> None: ...


class CloudflareDomainConnectConfig(TypedDict):
    sync_url: str
    provider_id: str
    service_id: str
    public_key_id: str
    private_key_pem: str


class ManagedIngestProviderConfigBase(TypedDict):
    cname_target: str
    cloudflare_domain_connect: NotRequired[CloudflareDomainConnectConfig]


class FakeProviderConfig(ManagedIngestProviderConfigBase):
    provider: Literal["fake"]


class CloudflareProviderConfig(ManagedIngestProviderConfigBase):
    provider: Literal["cloudflare"]
    api_token: str
    account_id: str
    zone_id: str
    kv_namespace_id: str


type ManagedIngestProviderConfig = FakeProviderConfig | CloudflareProviderConfig


class FakeManagedIngestProvider:
    name: Literal["fake"] = "fake"

    def __init__(self, cname_target: str) -> None:
        self.cname_target = cname_target

    def create_hostname(self, hostname: str) -> ProviderHostname:
        return ProviderHostname(
            id=f"fake:{hostname}",
            hostname=hostname,
            status="pending",
            certificate_status="pending_validation",
        )

    def get_hostname(self, provider_hostname_id: str) -> ProviderHostname:
        return ProviderHostname(
            id=provider_hostname_id,
            hostname=provider_hostname_id.removeprefix("fake:"),
            status="active",
            certificate_status="active",
        )

    def refresh_hostname(self, provider_hostname_id: str) -> ProviderHostname:
        return self.get_hostname(provider_hostname_id)

    def delete_hostname(self, provider_hostname_id: str) -> None:
        pass

    def put_edge_config(self, hostname: str, config: EdgeConfig) -> None:
        pass

    def delete_edge_config(self, hostname: str) -> None:
        pass


class _CloudflareSsl(TypedDict):
    status: NotRequired[str]


class _CloudflareHostname(TypedDict):
    id: str
    hostname: str
    status: NotRequired[str]
    ssl: NotRequired[_CloudflareSsl]
    verification_errors: NotRequired[list[str]]


class _CloudflareHostnameResponse(TypedDict):
    result: _CloudflareHostname


class _CloudflareClient(BaseApiClient):
    base_url = "https://api.cloudflare.com/client/v4"
    integration_type = "managed_ingest"
    managed_ingest_name = "cloudflare"
    metrics_prefix = "managed_ingest.cloudflare"
    allow_redirects = False

    def __init__(self, api_token: str) -> None:
        self.api_token = api_token
        super().__init__()

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        return self._request(
            method,
            path,
            headers={"Authorization": f"Bearer {self.api_token}"},
            **kwargs,
        )


class CloudflareManagedIngestProvider:
    name: Literal["cloudflare"] = "cloudflare"

    _ssl = {
        "method": "http",
        "type": "dv",
        "settings": {"min_tls_version": "1.2"},
    }

    def __init__(self, config: CloudflareProviderConfig) -> None:
        self.cname_target = config["cname_target"]
        self._zone_id = config["zone_id"]
        self._account_id = config["account_id"]
        self._kv_namespace_id = config["kv_namespace_id"]
        self._client = _CloudflareClient(config["api_token"])

    def create_hostname(self, hostname: str) -> ProviderHostname:
        response = cast(
            _CloudflareHostnameResponse,
            self._client.post(
                f"/zones/{self._zone_id}/custom_hostnames",
                data={"hostname": hostname, "ssl": self._ssl},
            ),
        )
        return self._hostname(response["result"])

    def get_hostname(self, provider_hostname_id: str) -> ProviderHostname:
        response = cast(
            _CloudflareHostnameResponse,
            self._client.get(f"/zones/{self._zone_id}/custom_hostnames/{provider_hostname_id}"),
        )
        return self._hostname(response["result"])

    def refresh_hostname(self, provider_hostname_id: str) -> ProviderHostname:
        response = cast(
            _CloudflareHostnameResponse,
            self._client.patch(
                f"/zones/{self._zone_id}/custom_hostnames/{provider_hostname_id}",
                data={"ssl": self._ssl},
            ),
        )
        return self._hostname(response["result"])

    def delete_hostname(self, provider_hostname_id: str) -> None:
        try:
            self._client.delete(f"/zones/{self._zone_id}/custom_hostnames/{provider_hostname_id}")
        except ApiError as error:
            if error.code != 404:
                raise

    def put_edge_config(self, hostname: str, config: EdgeConfig) -> None:
        self._client.put(self._edge_config_path(hostname), data=config)

    def delete_edge_config(self, hostname: str) -> None:
        try:
            self._client.delete(self._edge_config_path(hostname))
        except ApiError as error:
            if error.code != 404:
                raise

    def _edge_config_path(self, hostname: str) -> str:
        key = quote(f"host:{hostname}", safe="")
        return (
            f"/accounts/{self._account_id}/storage/kv/namespaces/"
            f"{self._kv_namespace_id}/values/{key}"
        )

    def _hostname(self, hostname: _CloudflareHostname) -> ProviderHostname:
        ssl = hostname.get("ssl")
        return ProviderHostname(
            id=hostname["id"],
            hostname=hostname["hostname"],
            status=hostname.get("status"),
            certificate_status=ssl.get("status") if ssl else None,
            verification_errors=tuple(hostname.get("verification_errors", ())),
        )


def is_managed_ingest_available() -> bool:
    return settings.SENTRY_MANAGED_INGEST is not None


def get_managed_ingest_provider() -> ManagedIngestProvider:
    config = cast(ManagedIngestProviderConfig | None, settings.SENTRY_MANAGED_INGEST)
    if config is None:
        raise ImproperlyConfigured("Managed ingest is not configured")
    if config["provider"] == "fake":
        return FakeManagedIngestProvider(config["cname_target"])
    return CloudflareManagedIngestProvider(config)

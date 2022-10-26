# Running Sentry in Hybrid Cloud (Updated 10/2022)

## Background on Silos

Historically, Sentry has operated with read/write access to all models/endpoints no matter where you are in the backend. This will be true going forward for self-hosted users and we will continue support for this simplified deployment model, denoting it as `Monoltih Mode`.

For SaaS deployment, we want to introduce sensitive data residency as part of the Hybrid Cloud project. To do so, Sentry requires running two separate instance types and having them communicate between one another. They are:
- _Control Silo_ - contains global data that is universal to Sentry SaaS (Single Instance)
- _Region Silo_ - contains customer data that is relevant to that region of Sentry and that region only. Regions Silos cannot talk to one another. (Multiple Instances)

## Prerequisites

To set up the region silos locally, you'll need to make a few changes:

In `~/.sentry/sentry.conf.py`, add the following:

```python
from sentry.types.region import Region, RegionCategory
SENTRY_REGION_CONFIG = (
    Region(
        "region",
        1,
        "https://<YOUR-REGION-NGROK-SUBDOMAIN>.ngrok.io",
        RegionCategory.MULTI_TENANT
    ),
    ...
)
SENTRY_CONTROL_ADDRESS = "https://<YOUR-CONTROL-NGROK-SUBDOMAIN>.ngrok.io"
```
Explanation:
- `SENTRY_REGION_CONFIG`: A tuple of Region objects that describe the regions
- `Region() -> "region"`: The user-friendly name of the region silo (e.g. `us-west`)
- `Region() -> 1`: The unique numerical ID of the the region silo
- `Region() -> "https://<YOUR-REGION-NGROK-SUBDOMAIN>.ngrok.io"`: The server address of the region silo
- `Region() -> RegionCategory`: Denotes the type of region silo that indicates how many customer organizations are being served from there. `MULTI_TENANT` indicates multiple organizations, `SINGLE_TENANT` indicates only one organization.
- You can add as many regions as you like, but they'll each require a separate instance of Sentry running to emulate production
- `SENTRY_CONTROL_ADDRESS`: The server address of the control silo

## Running the Silos

To spin up the silos, you'll need to bind one of the servers to a different port.
```shell
SENTRY_SILO_MODE=CONTROL sentry devserver
```

```shell
SENTRY_DEVSERVER_BIND=localhost:8002 SENTRY_SILO_MODE=REGION SENTRY_REGION=region sentry devserver
```
The `SENTRY_REGION` should match the `Region() -> name` that you declare in `sentry.conf.py`.

To set up ngrok, modify your `ngrok.yml` (`ngrok config edit`) to contain:

```yml
version: "2"
authtoken: <YOUR-NGROK-AUTHTOKEN>
tunnels:
    control-silo:
        proto: http
        hostname: <YOUR-CONTROL-NGROK-SUBDOMAIN>.ngrok.io
        addr: 8000
    region-silo:
        proto: http
        hostname: <YOUR-REGION-NGROK-SUBDOMAIN>.ngrok.io
        addr: 8002
```

Now you can spin up all the tunnels in the file with:
```
ngrok start --all
```

## Using Silo Clients

To make a **synchronous request** to another Sentry Silo, simply import the client of the silo you'd like to make a request to and provide approriate credentials:

```python
from sentry.silo.client import RegionSiloClient

client = RegionSiloClient("region") # For RegionSiloClient, provide the region name
response = client.get(
    "/organizations/slug/some-endpoint/",
    headers={"some": "header"}
    data={"some": "payload"}
)
print(response.json) # {'some': 'response'}
```

> Note: Protected endpoints may not work as expected while we figure out how API credentials work across silos.

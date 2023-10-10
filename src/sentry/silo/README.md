# Running Sentry in Hybrid Cloud (Updated 06/2023)

## Background on Silos

Historically, Sentry has operated with read/write access to all models/endpoints no matter where you are in the backend. This will be true going forward for self-hosted users and we will continue support for this simplified deployment model, denoting it as `Monoltih Mode`.

For SaaS deployment, we want to introduce sensitive data residency as part of the Hybrid Cloud project. To do so, Sentry requires running two separate instance types and having them communicate between one another. They are:
- _Control Silo_ - contains global data that is universal to Sentry SaaS (Single Instance)
- _Region Silo_ - contains customer data that is relevant to that region of Sentry and that region only. Regions Silos cannot talk to one another. (Multiple Instances)

## Prerequisites

To set up the region silos locally, you'll need to make a few changes:

1. Set up your local configuration in `~/.sentry/sentry.conf.py`:
```python
SENTRY_SUBNET_SECRET = 'secretsecretsecret' # Used for silos to verify HTTP requests coming from one another
SENTRY_MONOLITH_REGION = "us" # Default region for organizations created while in monolith mode
```
>  💡 If you're using ngrok, you'll need to add the following as well:
```python
from sentry.types.region import Region, RegionCategory
SENTRY_REGION_CONFIG = (
    Region(
        name="us", # user-friendly name of the region silo
        snowflake_id=1, # globally unique identifier of the region silo
        address="https://us.yourusername.ngrok.io", # full web address of the region silo
        category=RegionCategory.MULTI_TENANT, # MULTI_TENANT = many customers, SINGLE_TENTANT = single customer
        api_token="dev-region-silo-token" # An internal token used by the RPC for service calls
    ),
)
SENTRY_CONTROL_ADDRESS = "https://yourusername.ngrok.io"
```

1. Create the split databases for the two silo modes with `make create-db`
2. Split your local database with `bin/split-silo-database`

Example Output:
```sh
$ bin/split-silo-database
> Could not find silo assignment for django_admin_log
> Could not find silo assignment for auth_permission
> Could not find silo assignment for auth_group
> Could not find silo assignment for django_content_type
> Could not find silo assignment for django_session
> Could not find silo assignment for django_site
> 8 OrganizationMapping record(s) have been updated from '--monolith--' to 'us'
>> Dumping tables from sentry database
>> Building control database from dump file
>> Dumping tables from sentry database
>> Building region database from dump file
```

## Running the Silos

To spin up the silos, run:

```sh
SENTRY_USE_SILOS=1 sentry devserver
```

If using ngrok, it'll help to set up a config. Modify your `ngrok.yml` (`ngrok config edit`) to contain:

```yml
version: "2"
authtoken: <YOUR-NGROK-AUTHTOKEN>
tunnels:
    control-silo:
        proto: http
        hostname: yourusername.ngrok.io
        addr: 8001
    region-silo:
        proto: http
        hostname: us.yourusername.ngrok.io
        addr: 8011
```

Now you can spin up all the tunnels in the file with:

```sh
ngrok start --all
```

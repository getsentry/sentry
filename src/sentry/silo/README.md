# Running Sentry in Hybrid Cloud (Updated 06/2023)

## Background on Silos

Historically, Sentry has operated with read/write access to all models/endpoints no matter where you are in the backend. This will be true going forward for self-hosted users and we will continue support for this simplified deployment model, denoting it as `Monoltih Mode`.

For SaaS deployment, we want to introduce sensitive data residency as part of the Hybrid Cloud project. To do so, Sentry requires running two separate instance types and having them communicate between one another. They are:

- _Control Silo_ - contains global data that is universal to Sentry SaaS (Single Instance)
- _Region Silo_ - contains customer data that is relevant to that region of Sentry and that region only. Regions Silos cannot talk to one another. (Multiple Instances)

## Prerequisites

To set up the region silos locally, you'll need to make a few changes:

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
sentry devserver --silo=control --workers
sentry devserver --silo=region --workers --ingest
```

This will expose the following ports:

| Port | Purpose  | Silo    |
| ---- | -------- | ------- |
| 8000 | Webpack  | Control |
| 8001 | HTTP API | Control |
| 8010 | HTTP API | Region  |

You can omit the `--workers` and `--ingest` options if you don't want those services running.
If you're using `--ingest` and relay isn't being started make sure `settings.SENTRY_USE_RELAY` is enabled.

## Using Silos & ngrok

To use a siloed dev environment with ngrok you'll need to make a few application
configuration changes. Assuming your ngrok domain is `acme` add the following
to either `~/.sentry/sentry.conf` or `devlocal.py` in getsentry:

```python
SENTRY_OPTIONS["system.url-prefix"] = "https://acme.ngrok.dev"
CSRF_TRUSTED_ORIGINS = [".acme.ngrok.dev"]
ALLOWED_HOSTS = [".acme.ngrok.dev", ".ngrok.dev", "localhost", "127.0.0.1"]

SESSION_COOKIE_DOMAIN = ".acme.ngrok.dev"
CSRF_COOKIE_DOMAIN = SESSION_COOKIE_DOMAIN
SUDO_COOKIE_DOMAIN = SESSION_COOKIE_DOMAIN
```

Then start ngrok with the desired hostname:

```bash
ngrok http 8000 --domain=acme.ngrok.dev --host-header="localhost"
```

_Note:_ Some UI functionality relies on directly accessing the region silo API, so you may also need to expose it as well.

## Using ngrok configuration file

If using ngrok, it'll help to set up a config. Modify your `ngrok.yml` (`ngrok config edit`) to contain:

```yml
version: '2'
authtoken: <YOUR-NGROK-AUTHTOKEN>
tunnels:
  control-silo:
    proto: http
    hostname: yourdomain.ngrok.io
    host_header: 'rewrite'
    addr: 8000
  region-silo:
    proto: http
    hostname: us.yourdomain.ngrok.io
    addr: 8010
    host_header: 'rewrite'
```

Now you can spin up all the tunnels in the file with:

```sh
ngrok start --all
```

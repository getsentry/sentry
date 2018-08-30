Sentry Snap Package
===================
Sentry is a modern error logging and aggregation platform.

Installation
------------
Before installing, make sure you have the following availiable:

* Postgres database.
* Redis database.

Once you have these running, install Sentry with:
`sudo snap install sentry`

This will install 4 things:

* A `sentry` command to allow you to configure Sentry.
* 3 daemons, consisting of web, worker and cron.

The daemons can be accessed via `systemctl`, there names being:

* `snap.sentry.web`
* `snap.sentry.worker`
* `snap.sentry.cron`

At this point, we can initialise Sentry:

`sudo sentry init`

Note `sudo`.  This is because the daemons will be running as root (although confined by snapd).  If you run this without `sudo`, the running Sentry daemons won't be able to find the configuration files.

At this point, you can go and edit Sentry's config files to point them at your Postgres and Redis databases.  You can find the location of these files with:

`sudo sentry config discover`

Once edited, you need to run all pending migrations and setup a superuser with:

`sudo sentry upgrade`

Afterwards, restart the daemons with:

`sudo systemctl restart "snap.sentry.*"`

Now, you should be able to browse to http://localhost:9000[http://localhost:9000]

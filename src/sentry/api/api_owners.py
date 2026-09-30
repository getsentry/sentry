from sentry.owners import Owner

# Endpoints, tasks, and consumers share one owner enum. New code should import
# `Owner` from `sentry.owners`; this alias keeps existing endpoint imports working.
ApiOwner = Owner

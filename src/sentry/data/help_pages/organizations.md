----
title:Organizations
----
Organizations are the topmost organizational structure in Sentry.

## Membership

Membership is managed at the organizational level, but may cascade to teams. Specifically membership revolves around two things:

* The membership type (the level of access).
* The scope of the membership.

The general rules for access are as follows:

* Owner: Can perform severe/catastrophic operations (such as deleting the organization)
* Admin: Can manage settings as well as create projects (or teams, if they're scoped to the organization)
* Member: Can generally only view events

Scoping is based on the selection of teams (team-level scoping) or if the membership is selected to apply across all teams (org-level scoping).

## Billing and Quotas

Billing is managed at the Organization level (previously this was at the user level). An Organization's quota is spread across all projects within it.

This generally makes sense in the context of a personal vs a business account. You could be using a smaller plan on your personal account, and your company account could be on a much larger plan, as well as charging a different credit card.

## Stats

The stats page allows you to see usage across the organization. The important thing to note here is rejected events. Rejected events indicate the organization was beyond its subscription quota and those events were discarded.

## Audit Log

The Audit Log highlights activity across the organization. This will not include data before the audit log was enabled. Data will be recorded for nearly all changes to the organization, it's teams, or it's projects.

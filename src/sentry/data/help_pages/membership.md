----
title:Membership
----

## Roles

The core component of membership revolves around roles. Currently there are three such roles in Sentry:

- Owner
- Admin
- Member

Additionally there's a "global team member" flag, which effectively indicates that the member should have access organization-wide for their specific role. This affects what they can do greatly.

For example, an Owner role which does not have global access, but has access to a single team will be able effectively manage all things beyond membership for that team. That includes adding and removing projects, changing settings, etc.

Now if you flip the global access for the given Owner role, they will be able to manage the entirety of the organization, which includes removing access to other owners.

## Open Membership

An organization-wide setting is available which allows open membership. Effectively this will allow any member of your organization to join and leave any team without requesting permission. This will fit most organizations well, and is generally what we recommend.

Without open membership members will still be able to see all teams, but instead of being able to freely join them they'll have to request access. An access request can only be approved by an organization-wide admin (see Roles).

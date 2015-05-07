----
title:Single Sign-On
----

Single Sign-On (or SSO) allows you to manage your organization's entire membership via a third party provider.

## Preface

Before you get around to actually turning on SSO, you'll want to keep in mind that once it's activated, all existing users will need to link their account before they are able to continue using Sentry. Because of that we recommend coordinating with your team during off-peak hours. That said, it's super quick to link accounts, so we don't consider it a true hurdle.

## Getting Started

With that out of the way, head on over to your organization home. You'll see an "Auth" link in the sidebar. Start by hitting that, and then continue to the "Configure" link next to provider you wish to configure.

Additionally we'll automatically send each pre-existing member an email with instructions on linking their account. This will happen automatically once SSO is successfully configured. Even if they dont click the link, the next time they try to hit any page within the organization we'll require them to link their account (with the same auth flow you just went through).

## Default Membership

Every member who creates a new account via SSO will be given global organization access with a member role. This means that they can access events from any team, but they won't be able to create new projects or administer current ones.

## Security

Our SSO implementation prioritizes security. We aggressively monitor linked accounts and will disable them within any reasonable sign that the account's access may have been revoked. Generally this will be transparent to you, but if the provider is functioning in an unexpected way you may experience more frequent re-authorization requests.

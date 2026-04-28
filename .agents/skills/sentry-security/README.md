# sentry-security

Sentry-specific security review skill synthesized from real vulnerability history.

## Source Commits

This skill was synthesized by analyzing 37 security patches on `master` from 2025-02-18 to 2026-02-18. The patterns, examples, and checklists in the skill are derived directly from these fixes.

### IDOR / Cross-Org Data Access (9)

| SHA            | Date       | Description                                                                                              |
| -------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `893c7a939f53` | 2026-02-12 | Prevent cross-org condition injection via conditionGroupId IDOR (#108156)                                |
| `32114eed29f8` | 2026-02-10 | Fix IDOR vulnerability in group operations via qualified short ID                                        |
| `65ff1a9dc0fa` | 2026-01-15 | fix(security): IDOR in PromptsActivityEndpoint GET - scope project by organization (#104990)             |
| `179323a012b3` | 2026-01-08 | fix(security): IDOR in OrganizationOnDemandRuleStatsEndpoint - scope Project by organization (#104988)   |
| `f32888f2490e` | 2026-01-06 | fix(security): IDOR in OrganizationEventsEndpoint - scope DashboardWidget by organization (#104987)      |
| `8aff7c4bc575` | 2026-01-06 | fix(security): IDOR in OrganizationEventsStatsEndpoint - scope DashboardWidget by organization (#104986) |
| `58b5a8a1a1e6` | 2025-12-30 | Validate action filter organization ownership to prevent cross-org injection (#105533)                   |
| `b43b12ae9b1f` | 2025-12-16 | fix(security): IDOR in OrganizationDeriveCodeMappingsEndpoint - scope Project by organization (#104980)  |
| `5dfd66d27c04` | 2025-12-15 | fix: Correct missing organization constraint in PromptsActivityEndpoint (#104920)                        |

### Missing Authorization / Access Checks (10)

| SHA            | Date       | Description                                                                                              |
| -------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `d714026543ec` | 2026-02-17 | fix(teams): Prevent contributors from downgrading org admins' team roles (#108288)                       |
| `4f50b4dfb588` | 2026-01-27 | (fix): add auth check to ProjectOwnershipRequestSerializer (#107064)                                     |
| `1ccb2c745e61` | 2026-01-27 | Check default org membership before changing superuser/staff privilege (#106877)                         |
| `0c3841dfac16` | 2026-01-23 | add auth checks in detector workflow (#106815)                                                           |
| `89ab908aed98` | 2026-01-20 | Add project check to bundle assembly (#106571)                                                           |
| `7be714a12f39` | 2026-01-20 | feat(admin): Restrict /manage/ endpoint to non-SaaS modes (#106530)                                      |
| `45bc78fd5751` | 2026-01-02 | Add functional org filter to GroupEventJsonView (#105601)                                                |
| `fd7c6b1b8b94` | 2025-12-17 | fix(replays): restrict to active staff instead of superuser with user-based replay permissions (#105140) |
| `7049b522d84c` | 2025-09-15 | fix(coding-agents): set organization event permission on endpoint (#99515)                               |
| `6ace85cf45d3` | 2025-07-22 | fix(security): Simplify permissions check for notification actions (#95612)                              |

### Privilege Escalation / Role Abuse (3)

| SHA            | Date       | Description                                                                          |
| -------------- | ---------- | ------------------------------------------------------------------------------------ |
| `86fa75c2b7e5` | 2025-08-26 | fix(member-team-details): prevent role downgrade by low-privilege users (#98213)     |
| `fba35737f88d` | 2026-01-15 | Fix validators using ActorField, replace with OwnerActorField (#106074)              |
| `b6526b6333d2` | 2026-01-28 | Update OwnerActorField usage, refactor RuleSerializer, OpenAPI serializers (#106984) |

### Token / Session Security (5)

| SHA            | Date       | Description                                                                         |
| -------------- | ---------- | ----------------------------------------------------------------------------------- |
| `4a95d060eac6` | 2026-01-28 | Rate limit API requests if it's an impersonated session (#106814)                   |
| `8f2542c70d01` | 2025-12-19 | fix(sentry-apps): Prevent inactive applications from refreshing tokens (#105269)    |
| `6bfd39e82129` | 2025-12-16 | fix(oauth): Require organization_id for org-level access applications (#105064)     |
| `e14e33ebdcaa` | 2025-09-17 | fix(security): deny actions over org auth tokens by personal token (#99457)         |
| `461388ea4542` | 2025-06-02 | fix(security): do not allow auth user token requests if member is disabled (#92616) |

### XSS / Injection / Output Sanitization (4)

| SHA            | Date       | Description                                                                               |
| -------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `f7d362576663` | 2026-02-12 | fix(mail): Sanitize user display names in invite and integration request emails (#108165) |
| `849bff88fd8d` | 2026-02-12 | fix(mail): Sanitize user display names in team access request emails (#108154)            |
| `6c308dc7f9b2` | 2026-01-22 | fix: disallow custom CSS in marked (#106368)                                              |
| `ea60b818985`  | 2025-07-22 | fix(oauth): Add state validation to prevent promo code conflicts (#95742)                 |

### Authentication / MFA (3)

| SHA            | Date       | Description                                                                               |
| -------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `86483e5aee50` | 2026-02-17 | fix(security): Delete recovery codes when last primary authenticator is removed (#108264) |
| `1310f27ecc5f` | 2026-02-03 | fix(auth): Sync CSRF token on form submit for multi-tab scenarios (#107389)               |
| `97593dcac7ec` | 2026-01-30 | fix(auth): Fix CSRF token refresh for multi-tab auth scenarios (#107214)                  |

### Misc Security Hardening (3)

| SHA            | Date       | Description                                                                   |
| -------------- | ---------- | ----------------------------------------------------------------------------- |
| `cee38533b1ef` | 2026-01-30 | Fix for Open Team Membership in OwnerActorField and error messaging (#107333) |
| `07e8bf886fe2` | 2026-01-21 | SentryApps status fix (#105911)                                               |
| `17dab082e778` | 2025-11-17 | Upgrade Django to avoid CVE-2025-64459 (#103442)                              |

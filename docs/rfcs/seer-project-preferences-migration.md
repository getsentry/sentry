# RFC: Migrate Seer Project Preferences to Sentry

**Status:** Draft
**Author:** Josh Ferge
**Created:** 2026-02-04

## Summary

This RFC proposes migrating project-level autofix preferences (repository configurations, automation stopping points, and handoff settings) from Seer's database to Sentry. This simplifies the architecture by making Sentry the single source of truth for project configuration, improves security by keeping sensitive settings within Sentry's data boundary, and enables Sentry to pass preferences directly to Seer in autofix requests rather than Seer fetching them separately.

## Motivation

**Architectural simplification.** Seer is a compute service for AI/ML workloads. It should not own configuration data. Moving preferences to Sentry aligns with the principle that Sentry owns all customer configuration and Seer operates on data passed to it.

**Security.** Preferences contain integration IDs and custom instructions that may reference internal systems or sensitive context. Keeping this data within Sentry's security boundary reduces the attack surface and simplifies compliance (SOC2, data residency, etc.).

**Data locality.** Project configuration belongs with the project. Other project settings already live in Sentry (via `ProjectOption`, `RepositorySettings`, etc.). Having autofix preferences in a separate service creates an inconsistent data model.

**Reduced latency.** Currently, Seer fetches preferences via API call during autofix runs. With preferences in Sentry, they can be passed directly in the autofix request payload, eliminating a network round-trip.

## Background

### Current Architecture

Seer maintains a `seer_project_preferences` table with the following structure:

- `project_id` (primary key) - The Sentry project ID
- `organization_id` - The Sentry organization ID
- `repositories` (JSON) - List of repository configurations including:
  - `provider`, `owner`, `name`, `external_id` - Repository identification
  - `integration_id` - Sentry integration for Git access
  - `branch_name` - Default branch to use
  - `branch_overrides` - Dynamic branch selection based on event tags
  - `instructions` - Custom instructions for autofix in this repo
- `automated_run_stopping_point` - Controls how far autofix proceeds (root_cause → solution → code_changes → open_pr)
- `automation_handoff` - Configuration for handing off to external systems (e.g., Cursor)

### Current Data Flow

1. User configures preferences via Sentry UI
2. Sentry calls `POST /v1/project-preference/set` to store in Seer
3. When autofix runs, Seer fetches preferences from its own database
4. Sentry can query preferences via `POST /v1/project-preference`

### Sentry's Existing Repository Models

- `Repository` - Org-scoped repository metadata (name, provider, external_id)
- `RepositoryProjectPathConfig` - Maps repositories to projects for stack trace linking
- `RepositorySettings` - Code review settings (unrelated to autofix)

## Proposed Solution

[To be written]

## Data Model

[To be written]

## Migration Plan

[To be written]

## API Changes

[To be written]

## Rollout Plan

[To be written]

## Risks and Mitigations

[To be written]

## Open Questions

[To be written]

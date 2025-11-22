# Sentry Release & Deployment Data Model

## Entity Relationship Diagram

```mermaid
erDiagram
    Organization ||--o{ Release : "has"
    Organization ||--o{ Repository : "has"
    Organization ||--o{ Environment : "has"
    Organization ||--o{ CommitAuthor : "has"

    Release {
        bigint id PK
        bigint organization_id FK
        varchar version UK
        varchar ref
        varchar url
        datetime date_added
        datetime date_started
        datetime date_released
        jsonb data
        bigint owner_id FK
        int status
        int commit_count
        bigint last_commit_id FK
        text[] authors
        int total_deploys
        bigint last_deploy_id FK
        varchar package
        int major
        int minor
        int patch
        int revision
        varchar prerelease
        varchar build_code
        int build_number
    }

    Deploy {
        bigint id PK
        bigint organization_id FK
        bigint release_id FK
        bigint environment_id FK
        datetime date_finished
        datetime date_started
        varchar name
        varchar url
        boolean notified
    }

    Commit {
        bigint id PK
        bigint organization_id FK
        bigint repository_id FK
        bigint author_id FK
        varchar key UK
        datetime date_added
        text message
    }

    Repository {
        bigint id PK
        bigint organization_id FK
        varchar name
        varchar url
        varchar provider
        varchar external_id UK
        jsonb config
        int status
        datetime date_added
        bigint integration_id FK
        text[] languages
    }

    Environment {
        bigint id PK
        bigint organization_id FK
        varchar name UK
        datetime date_added
    }

    CommitAuthor {
        bigint id PK
        bigint organization_id FK
        varchar name
        varchar email UK
        varchar external_id UK
    }

    Distribution {
        bigint id PK
        bigint organization_id FK
        bigint release_id FK
        varchar name UK
        datetime date_added
    }

    ReleaseProject {
        bigint id PK
        bigint project_id FK
        bigint release_id FK
        int new_groups
        datetime adopted
        datetime unadopted
        datetime first_seen_transaction
    }

    ReleaseCommit {
        bigint id PK
        bigint organization_id FK
        bigint release_id FK
        bigint commit_id FK
        int order UK
    }

    ReleaseHeadCommit {
        bigint id PK
        bigint organization_id FK
        bigint repository_id FK
        bigint release_id FK
        bigint commit_id FK
    }

    ReleaseEnvironment {
        bigint id PK
        bigint organization_id FK
        bigint release_id FK
        bigint environment_id FK
        datetime first_seen
        datetime last_seen
    }

    ReleaseProjectEnvironment {
        bigint id PK
        bigint release_id FK
        bigint project_id FK
        bigint environment_id FK
        int new_issues_count
        datetime first_seen
        datetime last_seen
        bigint last_deploy_id FK
        datetime adopted
        datetime unadopted
    }

    EnvironmentProject {
        bigint id PK
        bigint project_id FK
        bigint environment_id FK
        boolean is_hidden
    }

    CommitFileChange {
        bigint id PK
        bigint organization_id FK
        bigint commit_id FK
        text filename UK
        char type
    }

    GroupRelease {
        bigint id PK
        bigint project_id FK
        bigint group_id FK
        bigint release_id FK
        varchar environment UK
        datetime first_seen
        datetime last_seen
    }

    GroupResolution {
        bigint id PK
        bigint group_id FK "unique"
        bigint release_id FK
        varchar current_release_version
        int type
        bigint actor_id FK
        datetime datetime
        int status
    }

    GroupCommitResolution {
        bigint id PK
        bigint group_id FK
        bigint commit_id FK
        datetime datetime
    }

    ReleaseFile {
        bigint id PK
        bigint organization_id FK
        bigint release_id FK
        bigint file_id FK
        bigint dist_id FK
        varchar ident UK
        text name
        datetime date_accessed
        int artifact_count
    }

    ReleaseActivity {
        bigint id PK
        bigint release_id FK
        int type
        jsonb data
        datetime date_added
    }

    Project {
        bigint id PK
        bigint organization_id FK
        varchar name
        varchar slug
    }

    Group {
        bigint id PK
        bigint project_id FK
        varchar culprit
        text message
        datetime first_seen
        datetime last_seen
    }

    File {
        bigint id PK
        varchar name
        varchar type
        int size
        text[] headers
        varchar checksum
        datetime timestamp
    }

    User {
        bigint id PK
        varchar email
        varchar name
    }

    %% Release Relationships
    Release ||--o{ Deploy : "has deployments"
    Release ||--o{ Distribution : "has distributions"
    Release ||--o{ ReleaseFile : "has files"
    Release ||--o{ ReleaseActivity : "has activities"
    Release ||--o{ ReleaseCommit : "contains"
    Release ||--o{ ReleaseHeadCommit : "has head commits"
    Release ||--o{ ReleaseEnvironment : "in"
    Release ||--o{ ReleaseProject : "deployed to"
    Release ||--o{ ReleaseProjectEnvironment : "scoped to"
    Release ||--o{ GroupRelease : "has issues"
    Release ||--o{ GroupResolution : "resolves issues"
    Release }o--|| User : "owned by"

    %% Deploy Relationships
    Deploy }o--|| Environment : "to environment"
    Deploy }o--|| Release : "of release"

    %% Commit Relationships
    Repository ||--o{ Commit : "has commits"
    Commit }o--|| CommitAuthor : "authored by"
    Commit ||--o{ CommitFileChange : "changes files"
    Commit ||--o{ ReleaseCommit : "in releases"
    Commit ||--o{ ReleaseHeadCommit : "is head of"
    Commit ||--o{ GroupCommitResolution : "resolves issues"

    %% Junction Table Relationships
    ReleaseCommit }o--|| Commit : "references"
    ReleaseHeadCommit }o--|| Repository : "for repository"
    ReleaseHeadCommit }o--|| Commit : "references"

    ReleaseProject }o--|| Project : "for project"
    ReleaseEnvironment }o--|| Environment : "for environment"

    ReleaseProjectEnvironment }o--|| Project : "for project"
    ReleaseProjectEnvironment }o--|| Environment : "in environment"
    ReleaseProjectEnvironment }o--|| Deploy : "last deployed"

    EnvironmentProject }o--|| Project : "for project"
    EnvironmentProject }o--|| Environment : "for environment"

    %% Issue Resolution Relationships
    GroupRelease }o--|| Group : "for issue"
    GroupResolution }o--|| Group : "for issue"
    GroupResolution }o--|| User : "by actor"
    GroupCommitResolution }o--|| Group : "for issue"
    GroupCommitResolution }o--|| Commit : "by commit"

    %% File Relationships
    ReleaseFile }o--|| File : "references"
    ReleaseFile }o--|| Distribution : "for distribution"

    %% Project Relationships
    Project ||--o{ ReleaseProject : "has releases"
    Project ||--o{ ReleaseProjectEnvironment : "has release environments"
    Project ||--o{ EnvironmentProject : "has environments"
    Project ||--o{ Group : "has issues"
    Project ||--o{ GroupRelease : "has issue releases"

    %% Group Relationships
    Group ||--|| GroupResolution : "has resolution"
```

## Key Relationships Explained

### Release Scoping (Three Levels)

1. **Organization-Environment**: `ReleaseEnvironment` tracks release presence in environments at org level
2. **Project**: `ReleaseProject` tracks which projects use a release
3. **Project-Environment**: `ReleaseProjectEnvironment` tracks release adoption per project+environment combination

### Commit Tracking

- **ReleaseCommit**: Ordered list of all commits included in a release (many-to-many with ordering)
- **ReleaseHeadCommit**: Tracks the HEAD commit for each repository in a release (one per repo per release)

### Deployment Flow

```
Release → Deploy → Environment
         ↓
    ReleaseProjectEnvironment.last_deploy_id
```

### Issue Resolution

- **GroupRelease**: Tracks when issues first/last appear in a release
- **GroupResolution**: Marks issues as resolved in a specific release (or next release)
- **GroupCommitResolution**: Links specific commits that fix issues

### File Artifacts

- **ReleaseFile**: Source maps, debug symbols, etc.
- **Distribution**: Variants of a release (e.g., different app builds)
- Files can be scoped to specific distributions

## Materialized Statistics

The Release model maintains denormalized counters for performance:

- `commit_count`: Total commits in release
- `total_deploys`: Number of deployments
- `last_commit_id`: Most recent commit
- `last_deploy_id`: Most recent deployment
- `authors`: Array of commit author names

## Semantic Versioning Support

Releases store parsed semantic version components:

- `package`: Package name
- `major`, `minor`, `patch`, `revision`: Version numbers
- `prerelease`: Pre-release identifier (alpha, beta, rc)
- `build_code`, `build_number`: Build metadata

This enables efficient semver queries and comparisons.

## Adoption Lifecycle

Both `ReleaseProject` and `ReleaseProjectEnvironment` track:

- `adopted`: When release became active
- `unadopted`: When release was replaced

States:

- **ADOPTED**: Currently active release
- **LOW_ADOPTION**: Has been seen but not adopted
- **REPLACED**: Previously adopted, now superseded

## Unique Constraints

| Model                     | Unique Together                                            |
| ------------------------- | ---------------------------------------------------------- |
| Release                   | (organization_id, version)                                 |
| Repository                | (organization_id, provider, external_id)                   |
| Environment               | (organization_id, name)                                    |
| Commit                    | (repository_id, key)                                       |
| CommitAuthor              | (organization_id, email) OR (organization_id, external_id) |
| ReleaseProject            | (project_id, release_id)                                   |
| ReleaseCommit             | (release_id, commit_id) AND (release_id, order)            |
| ReleaseHeadCommit         | (repository_id, release_id)                                |
| ReleaseEnvironment        | (organization_id, release_id, environment_id)              |
| ReleaseProjectEnvironment | (project_id, release_id, environment_id)                   |
| Distribution              | (release_id, name)                                         |
| CommitFileChange          | (commit_id, filename)                                      |
| GroupRelease              | (group_id, release_id, environment)                        |

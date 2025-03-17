# Automatic Source Code Configurations

Developers who install Source Code Management integrations (e.g. GitHub) will automatically have their errors processed and attempts made to connect them to the source code that caused them.

Once a mapping between an error's file path and a repository is established, Sentry will create a code mapping.

If no previous code mappings were established for that project, the creation of the first code mapping will automatically improve Sentry's experience for that project since the following features will be enabled:

- In-app frames will have links to their source code
- Suspect commits will be created
- Sentry comments on pull requests will be created [1]

When a code mapping is created and the stack trace is not an in-app frame we can create a Sentry stack trace rule to mark them as in-app from then on [2]. Having at least one in-app frame is required to enable the features listed above.

During the creation of the first code mapping we can also import a CODEOWNERS file [2], thus, the following features will be enabled:

- Automatic code ownership and assignee suggestions

[1] Only available for GitHub.
[2] This feature is not yet implemented.

## FAQ

Will you access or store my source code?

- No, we do not store any source code content in Sentry besides the CODEOWNERS file.
- We analyze the file paths and repository names (if access is granted)

## Upcoming configurations & integrations

Configurations:

- Creating in-app stack trace rules
- Importing CODEOWNERS
- Keeping SCM Teams in sync with Sentry Teams

Integrations:

- GitLab
- Bitbucket

# Running Workflow Lab locally

Use the Sentry and Seer notebook branches together. Start the usual development services for both repositories and apply their migrations. In the Seer checkout, `make dev` starts the API and workers. In the Sentry checkout, `devservices serve` starts the application.

Configure Sentry’s `SEER_AUTOFIX_URL` to reach Seer (normally port 9091). Sentry’s `SEER_API_SHARED_SECRET` must match one of Seer’s `JSON_API_SHARED_SECRETS`. The notebook agent uses Seer’s existing Sentry API and agent-token configuration. Point those calls at the same Sentry installation you open in the browser.

Sign in to a development organization with open membership and the Investigations feature. Open `/organizations/<org-slug>/seer/workflow-lab/`. Select the workflow and input JSON editors to adapt the example to a local project and detector. **Validate** checks the draft and displays its dependency graph. **Run** starts it using the signed-in user. The URL includes the accepted run ID, so reloading reopens it.

For a live run with `"notebook": true`, open **Notebook** between **Output** and **Run details**. It becomes available when Seer accepts the workflow. Blocks appear as the notebook agent writes them. **Usage** includes notebook generation and the metadata and next-step calls. The recovery scenarios use an isolated local PostgreSQL schema and a simulated agent response.

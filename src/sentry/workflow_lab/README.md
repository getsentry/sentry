# Workflow Lab

Sign in and open <http://dev.getsentry.net:8000/workflow-lab/sentry/>. Substitute the slug of an organization with Investigations enabled. Start the usual Sentry web and frontend dev servers and the Seer API, Celery workers and beat. Apply both projects’ migrations. Sentry’s Seer URL and signing secret must match the local Seer API. Seer’s Sentry base URL and agent-token configuration must point back to the same Sentry installation.

The editor, graph, results, recovery scenarios and notebook renderer all live here. **Run** sends the workflow name, input and request ID to the organization’s investigation-workflows API. Sentry signs the request with the current viewer’s identity. Edited definitions are validated and registered as immutable development drafts before submission to the same API. Run details, cancellation and usage use the durable workflow service.

For a workflow with `"notebook": true`, the Notebook tab appears between Output and Run details. It reads the organization’s notebook API and renders saved blocks with Explorer’s Code Mode components. The graph follows the selected run, including parallel map items, coordinator and worker rounds, notebook authoring, and the post-run steps. The Notebook tab refreshes throughout the run and fetches the final notebook and suggested next steps when the workflow finishes. Expand **Agent activity** in the completed notebook to read the public agent updates and Code Mode calls.

The recovery choices in the Run menu simulate failure against isolated local Postgres schemas. Set `WORKFLOW_LAB_SEER_CHECKOUT` on Sentry to a local Seer checkout with its virtualenv installed. By default the Lab looks for a sibling checkout named `Seer-loops` or `seer`. Set `WORKFLOW_LAB_KEEP_PROOF_DATA=1` to retain a simulation’s schema for inspection.

Delete this directory and restart the Sentry development servers to remove the Lab. The URL mount and notebook bundle entry are conditional on this folder. The organization workflow and notebook APIs continue to work independently.

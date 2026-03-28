#!/usr/bin/env bash
set -euo pipefail

# Run an AI agent inside a Coder workspace to perform RCA across multiple CI failures.
#
# The agent receives structured context about N recent failures and produces
# a cross-failure analysis identifying patterns, root causes, and action items.
#
# Prerequisites:
#   coder CLI must be installed and authenticated (via coder/setup-action)
#
# Required env vars:
#   WORKSPACE_NAME       - Coder workspace name
#   FAILURES_JSON        - JSON array of failure objects (each with run_id, failed_jobs, etc.)
#   FAILURE_SUMMARY      - Human-readable summary with stats
#   FAILURE_COUNT        - Number of failures being analyzed
#   SEVERITY             - deploy-blocked | flaky-investigation | general
#   WORKFLOW_FILTER      - Which workflows were scanned
#   BRANCH_FILTER        - Branch filter (may be empty)

echo "Resolving workspace '${WORKSPACE_NAME}'..."
WORKSPACE_ID=$(coder show "${WORKSPACE_NAME}" --output json | jq -r '.id')
echo "Workspace: ${WORKSPACE_ID}"

# ---------- Severity-specific instructions ----------

case "$SEVERITY" in
    deploy-blocked)
        SEVERITY_INSTRUCTIONS="
CRITICAL: Deploys are blocked. This is the highest priority.

Your analysis must answer:
1. Is there a single root cause across multiple failures, or are they independent?
2. For each cluster of failures: is it a code regression, flaky test, or infrastructure issue?
3. If code regression: identify the EXACT commit and PR that introduced it, and who authored it.
4. Recommendation priority: revert (with specific commit/PR) > fix-forward (with patch) > retry (if infra flake).
5. For flaky tests blocking deploys: should they be quarantined immediately?
6. Estimate: if we revert/fix the top issue, how many of the ${FAILURE_COUNT} failures would be resolved?
"
        ;;
    flaky-investigation)
        SEVERITY_INSTRUCTIONS="
This is a flaky test investigation across ${FAILURE_COUNT} failures. Focus on:

1. Which tests appear in MULTIPLE failures? These are the flakiest — rank by frequency.
2. For each flaky test cluster, identify the root cause pattern:
   - Shared mutable state between tests
   - Timing/race conditions (async, threading, timeouts)
   - Database state leaks (missing cleanup, ordering)
   - External service dependencies (redis, kafka, celery)
   - Resource contention (memory, file handles, ports)
3. Are failures correlated with specific times of day, branches, or commit patterns?
4. For each flaky test, suggest a concrete fix (not just 'add retry').
"
        ;;
    general)
        SEVERITY_INSTRUCTIONS="
General CI failure analysis across ${FAILURE_COUNT} recent failures. Provide:

1. Categorize each failure: code-bug, flaky-test, infrastructure, dependency, configuration.
2. Identify any patterns or clusters.
3. Prioritize: which failures are most impactful and most fixable?
4. For the top 3 issues, provide specific fix recommendations.
"
        ;;
esac

# ---------- Build the agent prompt ----------

AGENT_PROMPT=$(cat <<'PROMPT_HEADER'
You are a CI failure root cause analysis agent for the Sentry codebase.
You are analyzing MULTIPLE recent CI failures to find patterns, common root causes,
and produce actionable recommendations.

PROMPT_HEADER
)

AGENT_PROMPT+=$(cat <<PROMPT_CONTEXT

## Failure Summary

${FAILURE_SUMMARY}

## All Failures (structured)

\`\`\`json
${FAILURES_JSON}
\`\`\`

## Analysis Parameters
- **Failures to analyze**: ${FAILURE_COUNT}
- **Workflow filter**: ${WORKFLOW_FILTER}
- **Branch filter**: ${BRANCH_FILTER:-all branches}
- **Severity**: ${SEVERITY}

## Severity-Specific Instructions
${SEVERITY_INSTRUCTIONS}

PROMPT_CONTEXT
)

AGENT_PROMPT+=$(cat <<'PROMPT_TASK'

## Your Task

### Phase 1: Triage (do this first)
1. Parse the failures JSON to identify the distinct failing job names across all runs.
2. Group failures by failing job name — which jobs fail most often?
3. Group failures by commit SHA — are multiple failures from the same commit?
4. Group failures by branch — is master broken, or is it PR-specific?

### Phase 2: Deep dive (for top failure clusters)
For each of the top 3 most frequent failure patterns:
1. Check out the relevant commit: `git checkout <sha>`
2. Read the failing test code and the code under test.
3. Check `git log --oneline -20` for recent changes to the relevant files.
4. Look at the diff that may have introduced the failure.
5. Try to reproduce: `.venv/bin/pytest -svv --reuse-db <test_path>`
6. Determine: is this a real regression, a flaky test, or an infrastructure issue?

### Phase 3: Cross-failure analysis
1. Look for common threads across failures:
   - Same test files appearing in different runs
   - Same source files modified in commits that trigger failures
   - Time-based patterns (failures started after a specific commit)
2. Identify the "blast radius" — how many failures would be fixed by addressing each root cause?

### Phase 4: Produce structured output
Write a JSON file to `/tmp/rca-result.json` with this exact schema:

```json
{
  "root_causes": [
    {
      "id": 1,
      "title": "Short title of this root cause",
      "description": "Detailed explanation with evidence",
      "category": "code-bug|flaky-test|infrastructure|dependency|configuration|unknown",
      "confidence": "high|medium|low",
      "affected_runs": ["list of run_ids affected by this root cause"],
      "affected_tests": ["list of test node IDs"],
      "relevant_commits": ["commit SHAs that introduced the issue"],
      "relevant_files": ["file paths involved"],
      "suggested_fix": "Specific actionable fix with file paths and code changes",
      "blast_radius": "N of M failures would be fixed"
    }
  ],
  "action_items": [
    {
      "priority": 1,
      "action": "What to do (e.g., 'Revert PR #12345' or 'Quarantine test_foo')",
      "rationale": "Why this is the right action",
      "estimated_impact": "How many failures this would resolve"
    }
  ],
  "overall_confidence": "high|medium|low",
  "patterns": {
    "most_failing_jobs": {"job_name": "count"},
    "most_failing_tests": {"test_nodeid": "count"},
    "failure_timeline": "Description of when failures started and any inflection points",
    "is_master_broken": true/false,
    "estimated_flake_rate": "X% of failures appear to be flakes vs real regressions"
  },
  "full_analysis": "Detailed multi-paragraph analysis with all evidence, code references, and reasoning"
}
```

IMPORTANT:
- Be thorough but efficient. Start with the highest-frequency failures.
- Always ground your analysis in actual code — read the files, don't guess.
- If you can't reproduce locally, note that and analyze from code reading alone.
- Write the JSON result file even if your confidence is low.
- Focus on ACTIONABLE output — every root cause should have a suggested fix.
PROMPT_TASK
)

# ---------- Execute the agent via Coder CLI ----------

echo "Launching RCA agent in workspace (analyzing ${FAILURE_COUNT} failures)..."

# Write prompt to temp file to avoid shell escaping issues
PROMPT_FILE=$(mktemp)
printf '%s' "$AGENT_PROMPT" > "$PROMPT_FILE"

# Execute Claude Code inside the Coder workspace
coder ssh "${WORKSPACE_NAME}" -- bash -c "
        cat > /tmp/rca-prompt.txt << 'INNER_EOF'
$(cat "$PROMPT_FILE")
INNER_EOF

        # Run Claude Code with the prompt (non-interactive)
        cd /home/sentry/sentry && \
        claude --print --prompt-file /tmp/rca-prompt.txt \
            --allowedTools 'Bash(command:*)' 'Read' 'Glob' 'Grep' \
            --max-turns 50 \
            2>&1 | tee /tmp/rca-agent-output.txt

        # Ensure the result file exists even if the agent didn't create it
        if [ ! -f /tmp/rca-result.json ]; then
            echo '{
                \"root_causes\": [{\"id\": 1, \"title\": \"Agent did not complete analysis\", \"description\": \"See agent output in workflow logs\", \"category\": \"unknown\", \"confidence\": \"low\", \"affected_runs\": [], \"affected_tests\": [], \"relevant_commits\": [], \"relevant_files\": [], \"suggested_fix\": \"Manual investigation required\", \"blast_radius\": \"unknown\"}],
                \"action_items\": [{\"priority\": 1, \"action\": \"Review workflow logs manually\", \"rationale\": \"Automated analysis did not complete\", \"estimated_impact\": \"unknown\"}],
                \"overall_confidence\": \"low\",
                \"patterns\": {},
                \"full_analysis\": \"Agent did not produce structured output. Check workflow logs for partial analysis.\"
            }' > /tmp/rca-result.json
        fi
    " || {
        echo "WARNING: Agent execution failed, will use partial results" >&2
    }

rm -f "$PROMPT_FILE"

# ---------- Extract results from workspace ----------

echo "Extracting RCA results from workspace..."

RCA_JSON=$(coder ssh "${WORKSPACE_NAME}" -- cat /tmp/rca-result.json 2>/dev/null || echo '{}')

echo "Raw RCA JSON:"
echo "$RCA_JSON" | jq . 2>/dev/null || echo "$RCA_JSON"

# ---------- Format outputs for GitHub Actions ----------

OVERALL_CONFIDENCE=$(echo "$RCA_JSON" | jq -r '.overall_confidence // "low"')

# Format root causes as markdown
ROOT_CAUSES=$(echo "$RCA_JSON" | jq -r '
  (.root_causes // []) | to_entries | map(
    .value | "#### \(.id // (.key + 1)). \(.title // "Unknown")\n" +
    "- **Category**: `\(.category // "unknown")`\n" +
    "- **Confidence**: `\(.confidence // "low")`\n" +
    "- **Blast radius**: \(.blast_radius // "unknown")\n" +
    "- **Description**: \(.description // "N/A")\n" +
    "- **Suggested fix**: \(.suggested_fix // "N/A")\n"
  ) | join("\n")')

# Format action items as markdown
ACTION_ITEMS=$(echo "$RCA_JSON" | jq -r '
  (.action_items // []) | map(
    "- **P\(.priority // "?")**: \(.action // "N/A") — _\(.rationale // "")_ (impact: \(.estimated_impact // "unknown"))"
  ) | join("\n")')

# Format full analysis
FULL_ANALYSIS=$(echo "$RCA_JSON" | jq -r '.full_analysis // "No detailed analysis available"')

# Format patterns
PATTERNS=$(echo "$RCA_JSON" | jq -r '
  .patterns // {} |
  "**Master broken**: \(.is_master_broken // "unknown")\n" +
  "**Estimated flake rate**: \(.estimated_flake_rate // "unknown")\n" +
  "**Failure timeline**: \(.failure_timeline // "N/A")\n" +
  "**Most failing jobs**: \((.most_failing_jobs // {}) | to_entries | map("\(.key): \(.value)") | join(", "))\n" +
  "**Most failing tests**: \((.most_failing_tests // {}) | to_entries | map("\(.key): \(.value)") | join(", "))"')

# Build full RCA report markdown
RCA_REPORT=$(cat <<REPORT_EOF
### Patterns

${PATTERNS}

### Root Causes

${ROOT_CAUSES:-_No root causes identified_}

### Action Items

${ACTION_ITEMS:-_No action items identified_}

### Detailed Analysis

${FULL_ANALYSIS}
REPORT_EOF
)

# Write to GITHUB_OUTPUT using heredoc delimiters for multi-line safety
{
    echo "root_causes<<GHEOF"
    echo "$ROOT_CAUSES"
    echo "GHEOF"

    echo "action_items<<GHEOF"
    echo "$ACTION_ITEMS"
    echo "GHEOF"

    echo "overall_confidence=${OVERALL_CONFIDENCE}"

    echo "rca_report<<GHEOF"
    echo "$RCA_REPORT"
    echo "GHEOF"
} >> "$GITHUB_OUTPUT"

echo "RCA analysis complete. Overall confidence: ${OVERALL_CONFIDENCE}"

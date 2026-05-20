#!/usr/bin/env bash
#
# Manual curl tests for the single seer project repo details endpoint:
#   GET/PUT/DELETE /api/0/organizations/{slug}/seer/projects/{pid}/repos/{rid}/
#
# Prerequisites:
#   1. devservices up && devservices serve  (or sentry devserver)
#   2. Run the setup section first to create test data via Django shell
#
# Usage:
#   bash scripts/test_seer_project_repo_endpoint.sh

set -euo pipefail

BASE="http://127.0.0.1:8000/api/0"

# --------------------------------------------------------------------------
# CONFIG — fill these in after running the setup script below
# --------------------------------------------------------------------------
ORG_SLUG=""
PROJECT_ID=""
REPO_ID=""
AUTH_TOKEN=""

if [[ -z "$ORG_SLUG" || -z "$PROJECT_ID" || -z "$REPO_ID" || -z "$AUTH_TOKEN" ]]; then
  cat <<'SETUP'

=== STEP 1: Create test data ===

Run this in `sentry django shell`:

  from sentry.models.user import User
  from sentry.models.organization import Organization
  from sentry.models.project import Project
  from sentry.models.repository import Repository
  from sentry.models.projectrepository import ProjectRepository
  from sentry.seer.models.project_repository import SeerProjectRepository, SeerProjectRepositoryBranchOverride
  from sentry.models.apitoken import ApiToken
  from sentry.hybridcloud.models.apitoken import ApiTokenReplica

  # Use an existing superuser, or create one
  user = User.objects.filter(is_superuser=True).first()
  if not user:
      user = User.objects.create_superuser("admin@localhost", password="admin")
  print(f"User: {user.email} (id={user.id})")

  # Use an existing org or the first one
  org = Organization.objects.first()
  print(f"Org: {org.slug} (id={org.id})")

  # Use an existing project or create one
  project = Project.objects.filter(organization=org).first()
  if not project:
      from sentry.models.team import Team
      team = Team.objects.filter(organization=org).first()
      project = Project.objects.create(organization=org, name="test-project")
      if team:
          project.add_team(team)
  print(f"Project: {project.name} (id={project.id})")

  # Create a repo with a supported provider
  repo, _ = Repository.objects.get_or_create(
      organization_id=org.id,
      name="getsentry/sentry",
      defaults=dict(
          provider="integrations:github",
          external_id="123456",
          status=0,  # ACTIVE
      ),
  )
  print(f"Repo: {repo.name} (id={repo.id})")

  # Link project <-> repo
  pr, _ = ProjectRepository.objects.get_or_create(
      project=project,
      repository=repo,
  )

  # Create the seer project repo
  spr, _ = SeerProjectRepository.objects.get_or_create(
      project_repository=pr,
      defaults=dict(
          branch_name="main",
          instructions="Fix bugs carefully.",
      ),
  )
  print(f"SeerProjectRepository: id={spr.id}")

  # Add a branch override
  bo, _ = SeerProjectRepositoryBranchOverride.objects.get_or_create(
      seer_project_repository=spr,
      tag_name="environment",
      tag_value="production",
      defaults=dict(branch_name="release"),
  )
  print(f"BranchOverride: id={bo.id}")

  # Create an auth token
  token = ApiToken.objects.create(user=user, scope_list=["org:read", "org:write", "project:read", "project:write"])
  # Also create the replica so cell silo can find it
  ApiTokenReplica.objects.get_or_create(
      apitoken_id=token.id,
      defaults=dict(
          user_id=user.id,
          token=token.token,
          hashed_token=token.hashed_token,
          scope_list=token.scope_list,
          application_id=token.application_id,
          expiration_date=token.expires_at,
      ),
  )
  print(f"\nAuth token: {token.token}")

  print(f"\n--- Paste these into the script ---")
  print(f'ORG_SLUG="{org.slug}"')
  print(f'PROJECT_ID="{project.id}"')
  print(f'REPO_ID="{repo.id}"')
  print(f'AUTH_TOKEN="{token.token}"')

SETUP
  exit 0
fi

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
HR="$(printf '=%.0s' {1..60})"

run_curl() {
  local label="$1"; shift
  echo ""
  echo "$HR"
  echo "  $label"
  echo "$HR"
  echo "  → $1 $2"
  echo ""

  local method="$1"; shift
  local url="$1"; shift

  local http_code
  local body
  body=$(curl -s -w '\n%{http_code}' \
    -X "$method" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    "$@" \
    "$url")

  http_code=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')

  echo "  Status: $http_code"
  if [[ -n "$body" ]]; then
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
  fi
  echo ""
}

URL="$BASE/organizations/$ORG_SLUG/seer/projects/$PROJECT_ID/repos/$REPO_ID/"

# --------------------------------------------------------------------------
# 1. GET — fetch repo details
# --------------------------------------------------------------------------
run_curl "GET repo details" \
  GET "$URL"

# --------------------------------------------------------------------------
# 2. PUT — update branch name only
# --------------------------------------------------------------------------
run_curl "PUT: update branchName only" \
  PUT "$URL" \
  -d '{"branchName": "develop"}'

# --------------------------------------------------------------------------
# 3. PUT — update instructions only
# --------------------------------------------------------------------------
run_curl "PUT: update instructions only" \
  PUT "$URL" \
  -d '{"instructions": "Always write tests first."}'

# --------------------------------------------------------------------------
# 4. PUT — update branch overrides only
# --------------------------------------------------------------------------
run_curl "PUT: update branchOverrides only (no save() on model)" \
  PUT "$URL" \
  -d '{"branchOverrides": [{"tagName": "environment", "tagValue": "staging", "branchName": "staging-branch"}]}'

# --------------------------------------------------------------------------
# 5. PUT — update everything at once
# --------------------------------------------------------------------------
run_curl "PUT: update all fields" \
  PUT "$URL" \
  -d '{
    "branchName": "main",
    "instructions": "Fix bugs carefully.",
    "branchOverrides": [
      {"tagName": "environment", "tagValue": "production", "branchName": "release"},
      {"tagName": "environment", "tagValue": "staging", "branchName": "staging"}
    ]
  }'

# --------------------------------------------------------------------------
# 6. PUT — clear optional fields (null / empty)
# --------------------------------------------------------------------------
run_curl "PUT: clear branchName and instructions (set to null/empty)" \
  PUT "$URL" \
  -d '{"branchName": null, "instructions": "", "branchOverrides": []}'

# --------------------------------------------------------------------------
# 7. PUT — empty body (should 400)
# --------------------------------------------------------------------------
run_curl "PUT: empty body (expect 400)" \
  PUT "$URL" \
  -d '{}'

# --------------------------------------------------------------------------
# 8. PUT — duplicate branch overrides (should 400)
# --------------------------------------------------------------------------
run_curl "PUT: duplicate branch overrides (expect 400)" \
  PUT "$URL" \
  -d '{
    "branchOverrides": [
      {"tagName": "environment", "tagValue": "production", "branchName": "release"},
      {"tagName": "environment", "tagValue": "production", "branchName": "hotfix"}
    ]
  }'

# --------------------------------------------------------------------------
# 9. PUT — restore data before delete test
# --------------------------------------------------------------------------
run_curl "PUT: restore data before delete" \
  PUT "$URL" \
  -d '{
    "branchName": "main",
    "instructions": "Fix bugs carefully.",
    "branchOverrides": [{"tagName": "environment", "tagValue": "production", "branchName": "release"}]
  }'

# --------------------------------------------------------------------------
# 10. GET — verify restored state
# --------------------------------------------------------------------------
run_curl "GET: verify restored state" \
  GET "$URL"

# --------------------------------------------------------------------------
# 11. DELETE — remove the repo
# --------------------------------------------------------------------------
run_curl "DELETE repo (expect 204)" \
  DELETE "$URL"

# --------------------------------------------------------------------------
# 12. GET — after delete (expect 404)
# --------------------------------------------------------------------------
run_curl "GET after delete (expect 404)" \
  GET "$URL"

# --------------------------------------------------------------------------
# 13. DELETE — idempotent (expect 404)
# --------------------------------------------------------------------------
run_curl "DELETE again (expect 404)" \
  DELETE "$URL"

echo ""
echo "Done. Re-run the Django shell setup to recreate test data."

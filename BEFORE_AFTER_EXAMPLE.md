# Before & After: Integration Not Found Error Handling

## Scenario: Seer calls RPC with integration not connected to organization

### BEFORE the fix

#### Error Message

```
NotFound: Integration not found
```

#### Logs

```json
{
  "level": "exception",
  "message": "coding_agent.rpc_launch_error",
  "extra": {
    "organization_id": 123,
    "integration_id": 456,
    "run_id": 12345
  }
}
```

#### RPC Response

```json
{
  "success": false
}
```

#### Problems

- ❌ Generic error message doesn't explain **why** integration wasn't found
- ❌ No way to distinguish between:
  - Integration doesn't exist at all
  - Integration exists but not connected to this organization
  - Integration is disabled/inactive
  - Integration is wrong provider type
- ❌ Seer receives no error details to understand what went wrong
- ❌ Difficult to debug without checking multiple services/databases

---

### AFTER the fix

#### Error Message

```
NotFound: Integration 456 is not connected to organization 123
```

#### Logs

```json
{
  "level": "warning",
  "message": "coding_agent.integration_not_connected",
  "extra": {
    "organization_id": 123,
    "integration_id": 456
  }
}
```

```json
{
  "level": "exception",
  "message": "coding_agent.rpc_launch_error",
  "extra": {
    "organization_id": 123,
    "integration_id": 456,
    "run_id": 12345,
    "error_type": "NotFound"
  }
}
```

#### RPC Response

```json
{
  "success": false,
  "error": "Integration 456 is not connected to organization 123"
}
```

#### Improvements

- ✅ Clear error message explains the specific problem
- ✅ Includes both organization and integration IDs for easy debugging
- ✅ Structured log key `coding_agent.integration_not_connected` enables:
  - Searching/filtering for this specific error
  - Building metrics/dashboards
  - Alerting on integration configuration issues
- ✅ Seer receives error details to handle appropriately
- ✅ Can quickly identify and resolve integration configuration issues

---

## All Error Scenarios

### 1. Integration Not Connected

**When**: Integration ID is not connected to the organization

**Error**: `Integration {id} is not connected to organization {org_id}`

**Log Key**: `coding_agent.integration_not_connected`

---

### 2. Integration Not Active

**When**: Integration is disabled or pending deletion

**Error**: `Integration {id} is not active for organization {org_id}`

**Log Key**: `coding_agent.integration_not_active`

**Log Extra**: Includes `status` field (e.g., `DISABLED`, `PENDING_DELETION`)

---

### 3. Integration Deleted

**When**: Integration was hard-deleted from database

**Error**: `Integration not found`

**Log Key**: `coding_agent.integration_deleted`

**Log Extra**: Includes `organization_integration_id`

---

### 4. Invalid Provider

**When**: Integration provider is not a coding agent (e.g., GitHub, Slack)

**Error**: `Not a coding agent integration`

**Log Key**: `coding_agent.invalid_provider`

**Log Extra**: Includes `provider` and `valid_providers` list

---

### 5. Invalid Installation

**When**: Integration installation type is incorrect

**Error**: `Invalid coding agent integration`

**Log Key**: `coding_agent.invalid_installation`

**Log Extra**: Includes `installation_type`

---

## Monitoring Benefits

### Before

- Single generic error made it hard to track trends
- Had to manually investigate each failure
- No visibility into which specific integration issues were common

### After

```sql
-- Track integration not connected errors
SELECT COUNT(*)
FROM logs
WHERE message = 'coding_agent.integration_not_connected'
AND timestamp > NOW() - INTERVAL '1 day'

-- Find most problematic integrations
SELECT extra->>'integration_id', COUNT(*) as failures
FROM logs
WHERE message LIKE 'coding_agent.integration_%'
GROUP BY extra->>'integration_id'
ORDER BY failures DESC
LIMIT 10
```

Now you can:

- ✅ Track each error type separately
- ✅ Identify problematic integrations
- ✅ Set up alerts for specific error patterns
- ✅ Build dashboards showing integration health

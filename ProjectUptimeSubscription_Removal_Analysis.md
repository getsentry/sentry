# ProjectUptimeSubscription Removal Analysis

## Current State

`ProjectUptimeSubscription` is still heavily integrated throughout the uptime system, despite the ongoing transition to the `Detector` system. The current architecture creates a `Detector` for each `ProjectUptimeSubscription`, but the old model remains the primary data source.

## Usage Analysis

### Core Dependencies (47 files affected)

1. **Model Definition & Utilities**
   - `src/sentry/uptime/models.py` - Core model definition and utility functions
   - `src/sentry/uptime/subscriptions/subscriptions.py` - CRUD operations
   - `src/sentry/uptime/grouptype.py` - Issue creation logic

2. **API Endpoints (8 files)**
   - `src/sentry/uptime/endpoints/bases.py` - Base endpoint class
   - `src/sentry/uptime/endpoints/serializers.py` - Serialization logic
   - `src/sentry/uptime/endpoints/project_uptime_alert_*.py` - CRUD endpoints
   - `src/sentry/uptime/endpoints/organization_uptime_stats.py` - Stats endpoint
   - `src/sentry/uptime/endpoints/organiation_uptime_alert_index.py` - List endpoint

3. **Background Processing**
   - `src/sentry/uptime/detectors/tasks.py` - Auto-detection logic
   - `src/sentry/uptime/detectors/result_handler.py` - Result processing
   - `src/sentry/uptime/consumers/results_consumer.py` - Kafka consumer
   - `src/sentry/uptime/subscriptions/tasks.py` - Background tasks

4. **Integration Points**
   - `src/sentry/quotas/types.py` - Quota system integration
   - `src/sentry/incidents/endpoints/` - Alert rules integration
   - `src/sentry/deletions/defaults/project.py` - Project deletion handling

5. **Frontend Integration**
   - `static/app/views/` - React components and API calls
   - Frontend components still use `projectUptimeSubscriptionId`

## Migration Challenges

### 1. Dual System Complexity
The current system maintains both `ProjectUptimeSubscription` and `Detector` in parallel:
```python
# Every ProjectUptimeSubscription creates a Detector
detector = create_detector_from_project_subscription(uptime_monitor)

# But operations still rely on ProjectUptimeSubscription
def get_project_subscription(detector: Detector) -> ProjectUptimeSubscription:
    return ProjectUptimeSubscription.objects.get(uptime_subscription_id=int(data_source.source_id))
```

### 2. Database Relationships
- Foreign key relationships with `Project`, `Environment`, `UptimeSubscription`
- Database constraints and indexes
- Audit log dependencies

### 3. API Backwards Compatibility
- Public API endpoints expose `ProjectUptimeSubscription` fields
- Frontend components expect specific data structure
- External integrations may depend on current API

### 4. Issue Tracking
Issues are still tagged with `ProjectUptimeSubscription.id`:
```python
# XXX(epurkhiser): This can be changed over to using the detector ID in the
# future once we're no longer using the ProjectUptimeSubscription.id as a tag.
"tags": {
    "uptime_rule": str(project_subscription.id),
}
```

## Removal Strategy

### Phase 1: Complete Detector Migration
1. **Update Issue Tagging**
   - Change from `uptime_rule: ProjectUptimeSubscription.id` to `uptime_rule: Detector.id`
   - Ensure issue history is preserved

2. **API Endpoint Migration**
   - Update endpoints to work directly with `Detector` objects
   - Create compatibility layer for existing API contracts
   - Update serializers to use `Detector` data

3. **Background Task Migration**
   - Update all background tasks to work with `Detector` objects
   - Remove dependencies on `ProjectUptimeSubscription` in processors

### Phase 2: Database Schema Changes
1. **Data Migration**
   - Ensure all existing `ProjectUptimeSubscription` records have corresponding `Detector` objects
   - Migrate any missing data to `Detector` system

2. **Constraint Updates**
   - Update database constraints to work with `Detector` objects
   - Modify foreign key relationships

### Phase 3: Code Cleanup
1. **Remove Model**
   - Delete `ProjectUptimeSubscription` model
   - Remove related database table
   - Clean up import statements

2. **Update Tests**
   - Rewrite tests to use `Detector` objects
   - Update test fixtures and factories

## Risks & Considerations

### High Risk
- **Breaking Change**: This would be a major breaking change affecting multiple systems
- **Data Loss**: Risk of losing historical data if migration is incomplete
- **Downtime**: Database migrations might require downtime
- **External Dependencies**: Unknown external systems may depend on current API

### Medium Risk
- **Frontend Compatibility**: Frontend components need significant updates
- **Audit Trail**: Audit logs reference `ProjectUptimeSubscription` IDs
- **Rollback Complexity**: Difficult to rollback once schema changes are applied

### Low Risk
- **Test Coverage**: Extensive test suite should catch most issues
- **Gradual Migration**: Can be done incrementally with feature flags

## Alternative Approaches

### Option 1: Deprecation Path
1. Mark `ProjectUptimeSubscription` as deprecated
2. Create new API endpoints using `Detector` objects
3. Maintain compatibility layer for 1-2 release cycles
4. Remove deprecated code in future version

### Option 2: Gradual Migration
1. Update internal systems to use `Detector` objects
2. Keep `ProjectUptimeSubscription` for API compatibility
3. Eventually remove when all consumers are updated

### Option 3: Hybrid Approach
1. Keep `ProjectUptimeSubscription` as a thin wrapper around `Detector`
2. Migrate core logic to `Detector` system
3. Maintain API compatibility without full removal

## Recommendation

Given the extensive usage and integration points, I recommend **Option 1: Deprecation Path** as the safest approach:

1. **Phase 1** (1-2 sprints): Create feature flags and new `Detector`-based APIs
2. **Phase 2** (2-3 sprints): Migrate internal systems to use `Detector` objects
3. **Phase 3** (1-2 sprints): Update frontend and external integrations
4. **Phase 4** (1 sprint): Remove deprecated `ProjectUptimeSubscription` code

This approach minimizes risk while achieving the goal of removing `ProjectUptimeSubscription` from the codebase.

## Next Steps

1. Confirm the removal strategy aligns with product requirements
2. Plan the migration phases with timeline estimates
3. Create feature flags for gradual rollout
4. Begin with internal system migration to `Detector` objects
5. Coordinate with frontend team for API updates

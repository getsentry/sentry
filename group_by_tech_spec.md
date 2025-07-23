# Group By Functionality for ACI Alert Rules - Technical Specification

## Overview

This document outlines the technical implementation for adding group by functionality to the ACI (Alert Creation Interface) approach for alert rules, specifically for `MetricIssue`. This will allow users to group metric data by dimensions (e.g., region, environment, service) and create separate issues for each group when thresholds are exceeded.

## Current State

Currently, the ACI workflow engine processes metric alerts as follows:

1. **Single Group Processing**: Each `QuerySubscriptionUpdate` contains a single aggregated value
2. **Single Issue Creation**: One issue is created per alert rule trigger
3. **No Grouping**: All data is aggregated into a single value before evaluation

The existing `MetricIssueDetectorHandler` extends `StatefulDetectorHandler` which already has built-in support for grouped data processing through the `extract_value` method returning `dict[DetectorGroupKey, DataPacketEvaluationType]`.

## Proposed Changes

### 1. Data Model Extensions

#### 1.1 SnubaQuery Model Extension

Add support for group by fields in the SnubaQuery model:

```python
class SnubaQuery(Model):
    # ... existing fields ...

    # New field to store group by columns
    groupby_columns = ArrayField(
        models.CharField(max_length=64),
        default=list,
        help_text="List of columns to group by in the query"
    )
```

#### 1.2 Detector Model Extension

Extend the Detector model to support group by configuration:

```python
class Detector(Model):
    # ... existing fields ...

    # New field to store group by configuration
    group_by_config = models.JSONField(
        default=dict,
        help_text="Configuration for group by behavior including fingerprint template"
    )
```

#### 1.3 Current Detector Creation Flow

Currently, detectors are created through a **dual write** approach when alert rules are created:

1. **Legacy Alert Rule Creation**: `create_alert_rule()` in `src/sentry/incidents/logic.py` creates the legacy `AlertRule` object
2. **Dual Write Trigger**: The alert rule serializer calls `dual_write_alert_rule()` if the feature flag is enabled
3. **Workflow Engine Creation**: `dual_write_alert_rule()` calls `migrate_alert_rule()` which creates:
   - `DataSource` - links to the Snuba query subscription
   - `DataConditionGroup` - contains the threshold conditions
   - `Detector` - processes the data and creates issues
   - `Workflow` - handles actions and notifications
   - `DetectorState` - tracks detector state
   - Lookup tables (`AlertRuleDetector`, `AlertRuleWorkflow`, `DetectorWorkflow`)

The detector creation happens in `src/sentry/workflow_engine/migration_helpers/alert_rule.py`:

```python
def create_detector(
    alert_rule: AlertRule,
    project_id: int,
    data_condition_group: DataConditionGroup,
    user: RpcUser | None = None,
) -> Detector:
    detector_field_values = get_detector_field_values(
        alert_rule, data_condition_group, project_id, user
    )
    return Detector.objects.create(**detector_field_values)
```

**Key Integration Points:**
- **Alert Rule Serializer**: `src/sentry/incidents/serializers/alert_rule.py` calls `dual_write_alert_rule()` after creating the legacy alert rule
- **Migration Helper**: `src/sentry/workflow_engine/migration_helpers/alert_rule.py` contains the dual write logic
- **Feature Flag**: `organizations:workflow-engine-metric-alert-dual-write` controls when dual write happens

### 2. Data Flow Changes

#### 2.1 QuerySubscriptionUpdate Structure

Modify the `QuerySubscriptionUpdate` to support multiple groups:

```python
@dataclass
class GroupedQuerySubscriptionUpdate:
    """Represents a query subscription update with grouped data"""
    subscription_id: str
    timestamp: datetime
    entity: str
    groups: list[dict[str, Any]]  # List of group data with values and group keys

    @dataclass
    class GroupData:
        group_keys: dict[str, str]  # e.g., {"region": "us-east-1", "environment": "prod"}
        value: float
        metadata: dict[str, Any]  # Additional group-specific metadata
```

#### 2.2 Snuba Query Generation

Update the Snuba query generation to include group by clauses:

```python
def build_snuba_query_with_groupby(snuba_query: SnubaQuery) -> dict:
    """Build Snuba query with group by support"""
    query = {
        "dataset": snuba_query.dataset,
        "aggregations": [[snuba_query.aggregate, "", "aggregate"]],
        "groupby": snuba_query.groupby_columns,  # Add group by columns
        "conditions": snuba_query.query,
        "time_window": snuba_query.time_window,
        "resolution": snuba_query.resolution,
    }
    return query
```

### 3. Enhanced MetricIssueDetectorHandler

#### 3.1 Extend Existing Handler

Modify the existing `MetricIssueDetectorHandler` to support group by functionality:

```python
class MetricIssueDetectorHandler(StatefulDetectorHandler[QuerySubscriptionUpdate, int]):
    def extract_value(self, data_packet: DataPacket[QuerySubscriptionUpdate]) -> dict[DetectorGroupKey, int] | int:
        """Extract value from data packet, supporting grouped data"""
        values = data_packet.packet["values"]

        # Check if this is grouped data
        if "groups" in values:
            # Return grouped data as dict[DetectorGroupKey, int]
            grouped_values = {}
            for group_data in values["groups"]:
                group_keys = group_data.get("group_keys", {})
                group_value = group_data.get("value", 0)

                # Create group key from group keys
                group_key = self._create_group_key(group_keys)
                grouped_values[group_key] = group_value

            return grouped_values
        else:
            # Return single value for backward compatibility
            if values.get("value") is not None:
                return values.get("value")
            return values

    def _create_group_key(self, group_keys: dict[str, str]) -> DetectorGroupKey:
        """Create a deterministic group key from group keys"""
        if not group_keys:
            return None

        # Sort keys for deterministic ordering
        sorted_items = sorted(group_keys.items())
        key_string = "|".join(f"{k}={v}" for k, v in sorted_items)
        return key_string

    def build_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        """Build fingerprint for grouped issues"""
        base_fingerprint = [f"metric-issue-{self.detector.id}"]

        if group_key:
            # Add group-specific fingerprint
            group_by_config = self.detector.group_by_config or {}
            fingerprint_template = group_by_config.get("fingerprint_template", "{detector_id}-{group_key}")

            fingerprint = fingerprint_template.format(
                detector_id=self.detector.id,
                group_key=group_key
            )
            base_fingerprint.append(fingerprint)

        return base_fingerprint

    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[QuerySubscriptionUpdate],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        """Create occurrence with group-specific information"""
        try:
            alert_rule_detector = AlertRuleDetector.objects.get(detector=self.detector)
            alert_id = alert_rule_detector.alert_rule_id
        except AlertRuleDetector.DoesNotExist:
            alert_id = None

        try:
            detector_trigger = DataCondition.objects.get(
                condition_group=self.detector.workflow_condition_group, condition_result=priority
            )
        except DataCondition.DoesNotExist:
            raise DetectorException(
                f"Failed to find detector trigger for detector id {self.detector.id}, cannot create metric issue occurrence"
            )

        try:
            query_subscription = QuerySubscription.objects.get(id=data_packet.source_id)
        except QuerySubscription.DoesNotExist:
            raise DetectorException(
                f"Failed to find query subscription for detector id {self.detector.id}, cannot create metric issue occurrence"
            )

        try:
            snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
        except SnubaQuery.DoesNotExist:
            raise DetectorException(
                f"Failed to find snuba query for detector id {self.detector.id}, cannot create metric issue occurrence"
            )

        try:
            assignee = parse_and_validate_actor(
                str(self.detector.created_by_id), self.detector.project.organization_id
            )
        except Exception:
            assignee = None

        # Extract group information from data packet
        group_info = self._extract_group_info(data_packet)

        # Construct title and subtitle with group information
        title = self.construct_title(snuba_query, detector_trigger, priority, group_info)
        subtitle = self.construct_subtitle(snuba_query, detector_trigger, priority, group_info)

        return (
            DetectorOccurrence(
                issue_title=title,
                subtitle=subtitle,
                evidence_data={
                    "alert_id": alert_id,
                    "group_info": group_info,
                },
                evidence_display=[],
                type=MetricIssue,
                level="error",
                culprit="",
                assignee=assignee,
                priority=priority,
            ),
            {},
        )

    def _extract_group_info(self, data_packet: DataPacket[QuerySubscriptionUpdate]) -> dict[str, str] | None:
        """Extract group information from data packet"""
        values = data_packet.packet["values"]

        if "groups" in values:
            # For grouped data, we need to find the specific group
            # This would be determined by the group_key in the evaluation context
            # For now, return None - this will be enhanced based on the specific group being processed
            return None

        return None

    def construct_title(
        self,
        snuba_query: SnubaQuery,
        detector_trigger: DataCondition,
        priority: DetectorPriorityLevel,
        group_info: dict[str, str] | None = None,
    ) -> str:
        """Construct title with optional group information"""
        base_title = super().construct_title(snuba_query, detector_trigger, priority)

        if group_info:
            group_info_str = ", ".join(f"{k}: {v}" for k, v in group_info.items())
            return f"{base_title} ({group_info_str})"

        return base_title

    def construct_subtitle(
        self,
        snuba_query: SnubaQuery,
        detector_trigger: DataCondition,
        priority: DetectorPriorityLevel,
        group_info: dict[str, str] | None = None,
    ) -> str:
        """Construct subtitle with optional group information"""
        base_subtitle = super().construct_subtitle(snuba_query, detector_trigger, priority)

        if group_info:
            group_info_str = ", ".join(f"{k}: {v}" for k, v in group_info.items())
            return f"{base_subtitle} - Group: {group_info_str}"

        return base_subtitle
```

### 4. Data Processing Pipeline

#### 4.1 Subscription Processor Updates

Modify the subscription processor to handle grouped data:

```python
class SubscriptionProcessor:
    def process_grouped_update(self, subscription_update: GroupedQuerySubscriptionUpdate) -> None:
        """Process a subscription update with grouped data"""

        # Create a single data packet with grouped data
        data_packet = DataPacket[QuerySubscriptionUpdate](
            source_id=str(subscription_update.subscription_id),
            packet=subscription_update
        )

        # Process through existing detector pipeline
        # The StatefulDetectorHandler will automatically handle grouped data
        # through the enhanced extract_value method
        results = process_data_packets([data_packet], DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)

        for detector, evaluation_result in results:
            if evaluation_result.priority != DetectorPriorityLevel.OK:
                # Issues will be created automatically by the detector handler
                # for each group that exceeds thresholds
                pass
```

### 5. Frontend Changes

#### 5.1 Alert Rule Creation UI

Add group by configuration to the alert rule creation interface:

```typescript
interface GroupByConfig {
  enabled: boolean;
  columns: string[];
  fingerprintTemplate?: string;
  maxGroups?: number; // Limit number of groups to prevent explosion
}

interface AlertRuleFormData {
  // ... existing fields ...
  groupBy: GroupByConfig;
}
```

#### 5.2 Group By Column Selection

Implement a component for selecting group by columns:

```typescript
const GroupBySelector: React.FC<{
  availableColumns: string[];
  selectedColumns: string[];
  onChange: (columns: string[]) => void;
  maxGroups?: number;
}> = ({availableColumns, selectedColumns, onChange, maxGroups}) => {
  // Implementation for selecting group by columns
  // Show estimated number of groups based on selected columns
  // Warn if too many groups would be created
};
```

### 6. Database Schema Changes

#### 6.1 Migration Plan

Create database migrations to add new fields:

```python
# Migration 1: Add group by support to SnubaQuery
class Migration(migrations.Migration):
    dependencies = [
        ('sentry', 'previous_migration'),
    ]

    operations = [
        migrations.AddField(
            model_name='snubaquery',
            name='groupby_columns',
            field=django.contrib.postgres.fields.ArrayField(
                base_field=models.CharField(max_length=64),
                default=list,
                size=None,
            ),
        ),
    ]

# Migration 2: Add group by support to Detector
class Migration(migrations.Migration):
    dependencies = [
        ('sentry', 'previous_migration'),
    ]

    operations = [
        migrations.AddField(
            model_name='detector',
            name='group_by_config',
            field=models.JSONField(default=dict),
        ),
    ]
```

### 7. Configuration and Limits

#### 7.1 Group Limits

Implement limits to prevent issue explosion:

```python
class GroupByLimits:
    MAX_GROUPS_PER_ALERT = 100  # Maximum groups per alert rule
    MAX_GROUPS_PER_ORG = 1000   # Maximum total groups per organization
    MAX_GROUP_COLUMNS = 3       # Maximum number of group by columns

    @classmethod
    def validate_group_by_config(cls, group_by_config: dict) -> None:
        """Validate group by configuration"""
        columns = group_by_config.get("columns", [])
        if len(columns) > cls.MAX_GROUP_COLUMNS:
            raise ValueError(f"Too many group by columns: {len(columns)}")

        # Estimate number of groups (this would need actual data analysis)
        estimated_groups = cls._estimate_group_count(columns)
        if estimated_groups > cls.MAX_GROUPS_PER_ALERT:
            raise ValueError(f"Too many estimated groups: {estimated_groups}")
```

#### 7.2 Feature Flags

Add feature flags for gradual rollout:

```python
# Feature flags for group by functionality
GROUP_BY_ALERTS_ENABLED = "organizations:group-by-alerts"
GROUP_BY_ALERTS_BETA = "organizations:group-by-alerts-beta"
```

### 8. Testing Strategy

#### 8.1 Unit Tests

- Test enhanced `extract_value` method with grouped data
- Test fingerprint generation for different group combinations
- Test issue title/subtitle generation with group information
- Test group limits and validation

#### 8.2 Integration Tests

- Test end-to-end group by alert creation
- Test multiple groups triggering simultaneously
- Test group-specific issue resolution

#### 8.3 Performance Tests

- Test alert processing with large numbers of groups
- Test database performance with grouped issues
- Test Snuba query performance with group by clauses

### 9. Monitoring and Metrics

#### 9.1 Key Metrics

Track the following metrics:

```python
# Metrics to track
GROUP_BY_ALERTS_CREATED = "group_by_alerts.created"
GROUP_BY_ISSUES_CREATED = "group_by_issues.created"
GROUP_BY_GROUPS_PER_ALERT = "group_by_groups_per_alert"
GROUP_BY_PROCESSING_TIME = "group_by_processing_time"
GROUP_BY_LIMIT_EXCEEDED = "group_by_limit_exceeded"
```

#### 9.2 Alerting

Set up alerts for:

- Too many groups being created
- Group by processing taking too long
- Group by feature causing performance issues

### 10. Rollout Plan

#### 10.1 Phase 1: Infrastructure

1. Deploy database migrations
2. Deploy backend changes with feature flags disabled
3. Deploy frontend changes with feature flags disabled

#### 10.2 Phase 2: Beta Testing

1. Enable feature for beta organizations
2. Monitor metrics and performance
3. Gather feedback and iterate

#### 10.3 Phase 3: General Availability

1. Enable feature for all organizations
2. Monitor for issues
3. Optimize based on usage patterns

### 11. Risks and Mitigations

#### 11.1 Issue Explosion

**Risk**: Creating too many issues when many groups exceed thresholds
**Mitigation**: Implement group limits, rate limiting, and monitoring

#### 11.2 Performance Impact

**Risk**: Group by queries and processing impacting system performance
**Mitigation**: Optimize queries, implement caching, and monitor performance

#### 11.3 User Experience

**Risk**: Users creating too many groups and getting overwhelmed
**Mitigation**: Provide clear UI guidance, limits, and best practices

### 12. Future Enhancements

#### 12.1 Advanced Grouping

- Support for nested grouping
- Dynamic group discovery
- Group aggregation strategies

#### 12.2 Group Management

- Group-specific alert rules
- Group merging and splitting
- Group lifecycle management

#### 12.3 Analytics

- Group performance analytics
- Group correlation analysis
- Group trend detection

## Conclusion

This technical specification provides a comprehensive plan for implementing group by functionality in the ACI alert rules system using the existing `MetricIssueDetectorHandler`. The implementation leverages the built-in grouping infrastructure of `StatefulDetectorHandler` to create separate issues for each group when thresholds are exceeded.

The key success factors are:

1. **Leveraging Existing Infrastructure**: Using the existing `StatefulDetectorHandler` grouping capabilities
2. **Proper Group Limits and Validation**: Preventing issue explosion
3. **Efficient Fingerprint Generation**: Ensuring proper issue grouping
4. **Clear User Interface Guidance**: Helping users understand group by behavior
5. **Comprehensive Monitoring and Alerting**: Tracking system performance
6. **Gradual Rollout with Feature Flags**: Ensuring safe deployment

The implementation maintains backward compatibility while adding powerful new grouping capabilities to metric alerts.

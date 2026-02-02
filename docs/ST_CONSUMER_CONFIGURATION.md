# ST Consumer Configuration Guide

> **Last Updated**: 2026-02-02
> **Audience**: Streaming engineers, SREs, and developers working with ST (self-hosted) consumer configuration

## Overview

This document provides a comprehensive guide to the ST consumer configuration structure in the ops repository. Consumer configuration is distributed across multiple files in different directories for historical and organizational reasons. This guide helps you quickly find the right file to edit based on what you need to change.

## Quick Reference: "I need to change X" → "Edit file Y"

| What You Need to Change                             | File to Edit                         | Path Pattern                                                                                                      |
| --------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **KEDA Autoscaling (min/max replicas, cooldown)**   | `_values_<consumer>.yaml`            | `k8s/st-services-deprecated-do-not-add-new-services/getsentry/_values_<consumer>.yaml`                            |
| **Regional KEDA Overrides**                         | `default_<consumer>.yaml`            | `k8s/st-services-deprecated-do-not-add-new-services/getsentry/region_overrides/<region>/default_<consumer>.yaml`  |
| **Kafka Topic Configuration**                       | Topic definition YAML                | `shared_config/kafka/topics/<topic-name>.yaml`                                                                    |
| **Regional Kafka Topic Overrides**                  | Regional override YAML               | `shared_config/kafka/topics/regional_overrides/<region>/<topic-name>.yaml`                                        |
| **Consumer Deployment (replicas, resources, args)** | `_consumer-deployment.yaml` template | `k8s/st-services-deprecated-do-not-add-new-services/getsentry/_consumer-deployment.yaml`                          |
| **Verify KEDA ScaledObject**                        | Materialized manifest                | `k8s/materialized_manifests/<region>/default/getsentry/default-scaledobject-keda-getsentry-consumer-<topic>.yaml` |

## File Structure and Responsibilities

### 1. Base KEDA Configuration (`_values_<consumer>.yaml`)

**Location**: `k8s/st-services-deprecated-do-not-add-new-services/getsentry/_values_<consumer>.yaml`

**Purpose**: Defines the base KEDA autoscaling configuration for a consumer.

**Example File**: `_values_issues.yaml`

**What it Contains**:

- `keda.enabled`: Whether KEDA autoscaling is enabled
- `keda.minReplicaCount`: Minimum number of consumer replicas
- `keda.maxReplicaCount`: Maximum number of consumer replicas
- `keda.cooldownPeriod`: Time to wait after last trigger before scaling down
- `keda.pollingInterval`: How often to check metrics
- `keda.triggers`: Metrics and thresholds for scaling decisions

**Example Structure**:

```yaml
keda:
  enabled: true
  minReplicaCount: 2
  maxReplicaCount: 20
  cooldownPeriod: 300
  pollingInterval: 10
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka-broker:9092
        consumerGroup: ingest-events-group
        topic: ingest-events
        lagThreshold: '1000'
        activationLagThreshold: '100'
```

**When to Edit**:

- Adjusting autoscaling behavior (min/max replicas, scaling sensitivity)
- Changing KEDA polling or cooldown settings
- Modifying scaling triggers or thresholds

---

### 2. KEDA Template (`_consumer-deployment.yaml`)

**Location**: `k8s/st-services-deprecated-do-not-add-new-services/getsentry/_consumer-deployment.yaml`

**Purpose**: Helm template that generates Kubernetes Deployment and KEDA ScaledObject resources.

**What it Contains**:

- Deployment spec template (replicas, containers, resources)
- ScaledObject generation logic using values from `_values_*.yaml`
- Container command and arguments
- Environment variables and config maps
- Resource requests and limits

**Example Template Logic**:

```yaml
{{- if .Values.keda.enabled }}
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: keda-getsentry-consumer-{{ .Values.consumerName }}
spec:
  scaleTargetRef:
    name: getsentry-consumer-{{ .Values.consumerName }}
  minReplicaCount: {{ .Values.keda.minReplicaCount }}
  maxReplicaCount: {{ .Values.keda.maxReplicaCount }}
  cooldownPeriod: {{ .Values.keda.cooldownPeriod }}
  pollingInterval: {{ .Values.keda.pollingInterval }}
  triggers:
    {{- toYaml .Values.keda.triggers | nindent 4 }}
{{- end }}
```

**When to Edit**:

- Changing the Deployment structure (rarely needed)
- Modifying how KEDA ScaledObjects are generated (rarely needed)
- Adding new environment variables or config maps to all consumers
- **Note**: Most changes should be in `_values_*.yaml`, not this template

---

### 3. Regional Overrides (`region_overrides/<region>/default_<consumer>.yaml`)

**Location**: `k8s/st-services-deprecated-do-not-add-new-services/getsentry/region_overrides/<region>/default_<consumer>.yaml`

**Purpose**: Override base KEDA configuration for specific regions (e.g., `ly`, `us`, `eu`).

**Example File**: `region_overrides/ly/default_issues.yaml`

**What it Contains**:

- Region-specific overrides for any value in `_values_<consumer>.yaml`
- Typically overrides `minReplicaCount`, `maxReplicaCount`, `lagThreshold`
- Can override any Helm value defined in base configuration

**Example Structure**:

```yaml
# Override for Libya (ly) region - higher traffic region
keda:
  minReplicaCount: 5
  maxReplicaCount: 50
  triggers:
    - type: kafka
      metadata:
        lagThreshold: '5000' # Higher threshold for high-traffic region
```

**When to Edit**:

- Region has different traffic patterns requiring different scaling
- Region-specific performance tuning
- Temporary overrides for incidents or load testing

---

### 4. Kafka Topic Configuration (`shared_config/kafka/topics/`)

**Location**: `shared_config/kafka/topics/<topic-name>.yaml`

**Purpose**: Defines the base Kafka topic configuration (partitions, replication, retention).

**Example File**: `shared_config/kafka/topics/ingest-events.yaml`

**What it Contains**:

- Topic name
- Number of partitions
- Replication factor
- Retention policies (time and size)
- Cleanup policies
- Compression settings

**Example Structure**:

```yaml
topic_name: ingest-events
partitions: 64
replication_factor: 3
config:
  retention.ms: 86400000 # 24 hours
  retention.bytes: 107374182400 # 100 GB
  cleanup.policy: delete
  compression.type: snappy
  max.message.bytes: 5242880 # 5 MB
```

**When to Edit**:

- Changing topic partitions (requires careful planning)
- Adjusting retention policies
- Modifying replication factor

---

### 5. Regional Kafka Topic Overrides (`shared_config/kafka/topics/regional_overrides/`)

**Location**: `shared_config/kafka/topics/regional_overrides/<region>/<topic-name>.yaml`

**Purpose**: Override Kafka topic configuration for specific regions.

**Example File**: `shared_config/kafka/topics/regional_overrides/ly/ingest-events-backlog.yaml`

**What it Contains**:

- Region-specific topic configuration overrides
- Often used for backlog topics or regional performance tuning

**Example Structure**:

```yaml
# Override for ly region backlog topic
partitions: 128 # More partitions for high-traffic region
config:
  retention.ms: 172800000 # 48 hours (longer retention)
```

**When to Edit**:

- Region has unique traffic or retention requirements
- Backlog handling needs to be different per region

---

### 6. Materialized Manifests (Read-Only Reference)

**Location**: `k8s/materialized_manifests/<region>/default/getsentry/default-scaledobject-keda-getsentry-consumer-<topic>.yaml`

**Purpose**: **Read-only** generated Kubernetes manifests showing the final applied configuration.

**Example File**: `k8s/materialized_manifests/ly/default/getsentry/default-scaledobject-keda-getsentry-consumer-ingest-events-backlog.yaml`

**What it Contains**:

- Final ScaledObject YAML after Helm templating and value overrides
- Useful for debugging and verifying configuration
- **Do not edit directly** - these are generated from templates and values

**When to Use**:

- Debugging why KEDA isn't behaving as expected
- Verifying that regional overrides are applied correctly
- Checking what configuration is actually deployed to a region

---

## Configuration Hierarchy and Precedence

Configuration follows this precedence order (highest to lowest):

1. **Regional Overrides** (`region_overrides/<region>/default_<consumer>.yaml`)
2. **Base Consumer Values** (`_values_<consumer>.yaml`)
3. **Template Defaults** (`_consumer-deployment.yaml`)

Regional overrides merge with base values using Helm's value merging logic.

---

## Common Tasks and Workflows

### Task 1: Increase Max Replicas for a Consumer in All Regions

**Files to Edit**:

1. `k8s/st-services-deprecated-do-not-add-new-services/getsentry/_values_issues.yaml`

**Changes**:

```yaml
keda:
  maxReplicaCount: 30 # Changed from 20
```

---

### Task 2: Increase Max Replicas for a Consumer in One Region Only

**Files to Edit**:

1. `k8s/st-services-deprecated-do-not-add-new-services/getsentry/region_overrides/ly/default_issues.yaml`

**Changes**:

```yaml
keda:
  maxReplicaCount: 50 # Override just for ly region
```

---

### Task 3: Change Kafka Lag Threshold for Autoscaling

**Files to Edit**:

1. `k8s/st-services-deprecated-do-not-add-new-services/getsentry/_values_issues.yaml` (for all regions)
   OR
2. `k8s/st-services-deprecated-do-not-add-new-services/getsentry/region_overrides/<region>/default_issues.yaml` (for specific region)

**Changes**:

```yaml
keda:
  triggers:
    - type: kafka
      metadata:
        lagThreshold: '2000' # Changed from 1000
```

---

### Task 4: Increase Kafka Topic Partitions

**Files to Edit**:

1. `shared_config/kafka/topics/ingest-events.yaml` (for all regions)
   OR
2. `shared_config/kafka/topics/regional_overrides/<region>/ingest-events.yaml` (for specific region)

**Changes**:

```yaml
partitions: 128 # Changed from 64
```

**⚠️ Warning**: Increasing partitions is irreversible and requires careful planning. Coordinate with streaming team.

---

### Task 5: Adjust Kafka Topic Retention

**Files to Edit**:

1. `shared_config/kafka/topics/ingest-events.yaml`

**Changes**:

```yaml
config:
  retention.ms: 172800000 # Changed from 86400000 (24h → 48h)
```

---

## Consumer Names and Corresponding Files

| Consumer Name             | Values File                   | Kafka Topic             | Topic Config File                   |
| ------------------------- | ----------------------------- | ----------------------- | ----------------------------------- |
| **ingest-events**         | `_values_events.yaml`         | `ingest-events`         | `topics/ingest-events.yaml`         |
| **ingest-events-backlog** | `_values_events_backlog.yaml` | `ingest-events-backlog` | `topics/ingest-events-backlog.yaml` |
| **ingest-transactions**   | `_values_transactions.yaml`   | `ingest-transactions`   | `topics/ingest-transactions.yaml`   |
| **ingest-attachments**    | `_values_attachments.yaml`    | `ingest-attachments`    | `topics/ingest-attachments.yaml`    |
| **ingest-occurrences**    | `_values_occurrences.yaml`    | `ingest-occurrences`    | `topics/ingest-occurrences.yaml`    |

_(Add more consumers as needed)_

---

## Debugging Tips

### 1. Finding Where a Setting is Defined

**Problem**: "I see a setting in production, but where is it configured?"

**Solution**:

1. Check materialized manifest for the region: `k8s/materialized_manifests/<region>/default/getsentry/`
2. Look for the setting in regional overrides: `region_overrides/<region>/default_<consumer>.yaml`
3. Check base values: `_values_<consumer>.yaml`
4. Check template defaults: `_consumer-deployment.yaml`

---

### 2. Verifying Regional Overrides

**Problem**: "Did my regional override actually apply?"

**Solution**:

1. Check the materialized manifest for that region
2. Look for the specific value you overrode
3. If it doesn't match, check Helm value merging syntax

---

### 3. KEDA Not Scaling as Expected

**Problem**: "KEDA isn't scaling my consumer"

**Solution**:

1. Check the ScaledObject in materialized manifests
2. Verify `keda.enabled: true` in values
3. Check Kafka lag using Kafka monitoring tools
4. Verify `lagThreshold` and `activationLagThreshold` settings
5. Check KEDA controller logs in the cluster

---

## File Naming Conventions

| File Type                 | Naming Pattern                                              | Example                                                                   |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Base Consumer Values      | `_values_<consumer>.yaml`                                   | `_values_issues.yaml`                                                     |
| Regional Override         | `default_<consumer>.yaml`                                   | `default_issues.yaml`                                                     |
| Kafka Topic               | `<topic-name>.yaml`                                         | `ingest-events.yaml`                                                      |
| Kafka Regional Override   | `<topic-name>.yaml`                                         | `ingest-events-backlog.yaml`                                              |
| Materialized ScaledObject | `default-scaledobject-keda-getsentry-consumer-<topic>.yaml` | `default-scaledobject-keda-getsentry-consumer-ingest-events-backlog.yaml` |

---

## Regions

Current supported regions:

- `ly` - Libya (example region)
- `us` - United States
- `eu` - Europe
- _(Add other regions as needed)_

---

## Important Notes

### 1. SaaS vs ST Structure Differences

**SaaS (sentry.io)**:

- Consumer configuration may be in different files
- May use different autoscaling mechanisms
- Consult SaaS-specific documentation

**ST (Self-Hosted)**:

- Configuration structure documented in this guide
- Uses KEDA for autoscaling
- Deployed via Helm

### 2. Deprecated Directory Warning

The directory `k8s/st-services-deprecated-do-not-add-new-services/` is marked as deprecated, but is still actively used for existing consumers. **Do not add new consumers to this directory.** For new consumers, consult the streaming team for the current recommended structure.

### 3. Change Management

- **Always test changes in a dev/staging environment first**
- **Regional overrides should be used sparingly** - prefer fixing base configuration
- **Document why you made changes** in commit messages and any related incidents
- **Coordinate partition changes** with the streaming team - they're irreversible

---

## Relationship to Application Code

The consumer definitions in this repository (`sentry/src/sentry/consumers/__init__.py`) define the consumer logic and topic mappings:

```python
# From sentry/src/sentry/consumers/__init__.py
KAFKA_CONSUMERS = {
    "ingest-events": {
        "topic": Topic.INGEST_EVENTS,
        "strategy_factory": "sentry.ingest.consumer.factory.IngestStrategyFactory",
        # ...
    },
    # ...
}
```

The ops repo configuration (documented in this guide) controls:

- **Deployment and scaling** (KEDA, replicas)
- **Kafka topic infrastructure** (partitions, retention)
- **Regional customization** (overrides)

---

## Getting Help

If you're still unsure which file to edit:

1. **Ask in #streaming-team** Slack channel
2. **Check incident postmortems** for similar configuration changes
3. **Review recent commits** to the files mentioned in this guide
4. **Check with SRE on-call** if it's production-impacting

---

## Related Documentation

- **KEDA Documentation**: https://keda.sh/docs/
- **Helm Values Override**: https://helm.sh/docs/chart_template_guide/values_files/
- **Kafka Topic Configuration**: https://kafka.apache.org/documentation/#topicconfigs
- **Sentry Consumer Code**: `sentry/src/sentry/consumers/__init__.py`

---

## Changelog

| Date       | Change                        | Author       |
| ---------- | ----------------------------- | ------------ |
| 2026-02-02 | Initial documentation created | Cursor Agent |

---

## Appendix: Full Example

Here's a complete example showing all files involved in configuring the `ingest-events` consumer:

### Base Configuration

**File**: `k8s/st-services-deprecated-do-not-add-new-services/getsentry/_values_events.yaml`

```yaml
keda:
  enabled: true
  minReplicaCount: 2
  maxReplicaCount: 20
  cooldownPeriod: 300
  pollingInterval: 10
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka-broker:9092
        consumerGroup: ingest-events-group
        topic: ingest-events
        lagThreshold: '1000'
```

### Regional Override (Libya)

**File**: `k8s/st-services-deprecated-do-not-add-new-services/getsentry/region_overrides/ly/default_events.yaml`

```yaml
keda:
  minReplicaCount: 5
  maxReplicaCount: 50
  triggers:
    - type: kafka
      metadata:
        lagThreshold: '5000'
```

### Kafka Topic Configuration

**File**: `shared_config/kafka/topics/ingest-events.yaml`

```yaml
topic_name: ingest-events
partitions: 64
replication_factor: 3
config:
  retention.ms: 86400000
  retention.bytes: 107374182400
  cleanup.policy: delete
  compression.type: snappy
```

### Materialized Result (ly region)

**File**: `k8s/materialized_manifests/ly/default/getsentry/default-scaledobject-keda-getsentry-consumer-ingest-events.yaml`

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: keda-getsentry-consumer-ingest-events
  namespace: default
spec:
  scaleTargetRef:
    name: getsentry-consumer-ingest-events
  minReplicaCount: 5 # From regional override
  maxReplicaCount: 50 # From regional override
  cooldownPeriod: 300 # From base config
  pollingInterval: 10 # From base config
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka-broker:9092
        consumerGroup: ingest-events-group
        topic: ingest-events
        lagThreshold: '5000' # From regional override
```

This shows how the base configuration and regional overrides merge to produce the final deployed configuration.

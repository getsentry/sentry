# Spans Ingestion Pipeline

This module and its submodules contain most of the Sentry logic for spans
ingestion and processing. Specifically it contains the Spans Buffer and the
Segments consumer.

```mermaid
graph TD

  sdk@{ shape: text, label: "Spans" } -->
  relay[[Relay]] -- [topic] ingest-spans -->
  getsentry-consumer-process-spans -- [topic] buffered-segments -->
  getsentry-consumer-process-segments -- [topic] snuba-items --> snuba[[EAP]]
  getsentry-consumer-process-spans <--> sb[(Redis Cluster: rc-span-buffer)]
  getsentry-consumer-process-segments <--> pg[(Postgres / ORM)]
```

The pipeline follows the following steps:

1.  Relay receives spans from the SDKs and performs some basic enrichment to
    identify segments
2.  The Spans Buffer ([`buffer.py`](buffer.py), consumer: `getsentry-consumer-process-spans`) receives spans and
    assembles segments (trees of spans similar to transactions which are needed
    to power the product logic that was transactions based). It uses a Redis
    cluster as its storage
3.  Segments reach the Segments Consumer `getsentry-consumer-process-segments`)
    which performs segment level enrichment and other operations like issue
    detection
4.  Segments are exploded into enriched spans again and sent to EAP via another
    Kafka topic.

## Corner cases and rate limiters

This is a summary of all the scenarios where we drop data and the consequences
on the trace.

### Spans per second rate limiter

We cannot ingest unlimited events per second in any ingestion pipeline. All
event types are limited in terms of frequency.

- This is applied in Relay and the appropriate outcome is produced. Users are
  not charged for dropped spans

- This would generate incomplete traces and segments as any spans can be dropped
  no matter on the trace structure.

### Spans per second per trace rate limiter

- The buffer needs to group spans into segment in a single thread, this
  has a throughput limit. The good news is that we do not drop spans here,
  we just reshuffle them. The resulting segment is incomplete though,
  spans may be dangling.

- This is applied per trace in Relay. The user cannot send more than X spans per minute
  per trace. It is configured in [relay config](https://github.com/getsentry/ops/blob/a117ee546b130def3eb39ccdbf252229daafac1c/k8s/services/relay/_values.yaml#L61-L70).

### Maximum segment size

- We cannot have unlimited segments in size for four reasons:
  - Generally an extremely large segment would take an extremely long time to
    accumulate (unless spans payloads were huge). This would compromise data
    freshness.

  - Segments are accumulated in Redis. Redis does not have infinite size nor it
    can scale indefinitely. Moreover the user does not pay by size but we would
    pay Redis by memory.

  - Several features in the segment consumers, like issue detection, are not
    viable in huge segments.

  - Every kafka topic has a maximum message size, so we cannot send arbitrarily
    large segments between buffer and segmented consumer. Large segments could be
    offloaded in Object Store though or broken into smaller ones.

- The maximum segment size is configured via the `spans.buffer.max-segment-bytes`
  option.

- This limit is enforced in two places: while accumulating the segment in the
  buffer and when about to flush it to the segment consumer.
  - As we add spans to subsegments in Redis we prune sets that become too large.
    This is done by dropping spans until they stay in the max size. This, obviously
    breaks the structure of the trace as the missing spans may be anywhere in
    the tree.

  - As we extract the subsegments and reassemble them, if the segment is too big
    we either drop it or chunk it depending on the
    `spans.buffer.chunk-oversized-segments` option:
    - **Default (disabled)**: The segment is dropped entirely and an `invalid`
      outcome is recorded.
    - **Enabled**: The segment is kept and split into multiple Kafka messages,
      each within `max-segment-bytes`, and every chunk is sent with the flag
      `skip_enrichment=True`.

### Flushing segments

- The spans buffer cannot know when a segment is complete as there is no such
  a signal.

- There are competing requirements between data freshness and data completeness.
  On one hand we want to flush segments as soon as possible to make them available
  to the user. On the other hand, flushing too early yields incomplete segments
  as more spans may arrive after the segment is closed.

- The spans buffer flushes a segment when one of these two conditions is reached:
  - A root span for the segment has been ingested and `spans.buffer.root-timeout`
    seconds have passed without observing new spans for the segment.

  - A root span for the segment has not been ingested and `spans.buffer.timeout`
    seconds have passed without observing new spans for the segment.

- There are some consequence on data integrity:
  - Incomplete segments may be flushed if more spans arrive after the timeout.
    This would generate broken traces.

  - Some segment may accumulate forever and eventually pruned and dropped if the
    user keeps sending spans within the timeout.

# Assembling Segments

The Spans Buffer consumer receives spans in any order and assembles them into
segments. A Segment is a group of spans that have to be processed as a unit
in the following steps of the pipeline (like for issue detection).

A Segment represents a tree of spans.

Spans only have local knowledge. Each span identifies its direct parent in the
tree. So a span coming from the client does not necessarily know its segment.

Spans are in this form

```
    span1 = {"span_id": "a...", "parent_span_id": "b..."}
    span2 = {"span_id": "b...", "parent_span_id": "c..."}
    span3 = {"span_id": "c...", "parent_span_id": "d..."}
```

So, in order to assemble a segment from spans, we need to:

- navigate the tree upwards till the root to find the segment a span belongs to.
- be able to identify the root of a segment. There are a few conditions for this:
  - A span that does not specify a parent id is the root of a segment
  - A span with a segment marker provided by a client is the root of
    the segment.

The logic we use to assemble segments is divided between [`buffer.py`](buffer.py)
and [`add-buffer.lua`](../scripts/spans/add-buffer.lua). The first contains some additional
docs.

## Spans and buffer data model

This section explains the relationship between concepts and how data is stored
in Redis when assembling segments. This specifically addresses how these entities
are defined in [`buffer.py`](buffer.py) and [`add-buffer.lua`](../scripts/spans/add-buffer.lua).

```mermaid
erDiagram
    Span {
        string span_id PK "Unique identifier"
        string parent_span_id FK "Points to parent span"
        string segment_id FK "Optional: explicit segment ID"
        string trace_id "Trace this span belongs to"
        int project_id
        bytes payload
        float end_timestamp
        bool is_segment_span "True if this is segment root"
    }

    Segment {
        string root_span_id FK "The root span's span_id"
        string trace_id
        int project_id
    }

    Subsegment {
        string project_and_trace "Format: project_id:trace_id"
        string parent_span_id FK "The direct parent of the root of this Subsegment"
        list spans "List of Span objects in this batch"
    }

    Subsegment ||--|{ Span : "groups for batch processing"
    Segment ||--o{ Span : "contains all spans in tree"
```

**Span**

- This represents the Span data structure in the buffer.py module
- Most of the time it only identifies its direct parent via `parent_span_id`
- See the code in [`factory.py`](consumers/process/factory.py) to see how the fields are populated
- There are some scenarios where it can identify the segment:
  - is_segment_span: Tells us the span is the root of the segment. It is
    True if the Span does not have a parent (`parent_span_id` is None) or
    the payload coming from Relay contains the `is_segment` flag
  - `segment_id`, identifies the segment if this span is flagged as a root of
    a segment by the steps upstream in the pipeline: the payload from Relay
    contains the `sentry.segment.id` field.
  - If `span_id == parent_span_id` then this span is the root of the segment.
    Not sure if this is possible in the input from Relay but the [`buffer.py`](buffer.py)
    code resolves the parent_span_id as the `span_id` when `parent_span_id`
    is None.
  - If `parent_span_id` is None, this span should be the root of the trace.
    [TO BE VERIFIED]

**Segment**

- This is not an entity in the code. It is logically a group of spans that
  share transitively the same parent.
- It is entirely contained within a trace.
- It is also referred to as `set` in the LUA code

**Subsegment**

- This represents a batch of spans that transitively share the same parent.
- This is a subset of a segment that is processed as a batch when assembling
  the segment.
- As spans can reach the span buffer consumer in any order and as it would be
  inefficient to run the LUA script for each span, we group spans that definitively
  belong to the same segment in a batch and process them together.
- Spans in a subsegment are guaranteed to belong to the same segment. On the contrary
  it is not guaranteed that two subsegments belong to different segments. Subsegments
  are assembled without knowledge of the whole Segment tree, so the common parent
  between two subsegments may have not been received at the time of assembling them.

**Payload keys**

```
span-buf:s:{PROJECT_ID:TRACE_ID:SPAN_ID}:SPAN_ID
```

Each subsegment gets its own payload key (`{project_id:trace_id:span_id}:span_id`).
This distributes payloads across Redis cluster nodes instead of concentrating
all spans of a trace on a single node.

**Member-keys index**

```
span-buf:mk:{PROJECT_AND_TRACE}:ROOT_SPAN_ID
```

This is an unsorted set that tracks which payload keys belong to a
segment. The flusher reads this index to discover all payload keys, then scans
each one to load the span data.

## Redis data model

The redis code that is used to assemble segments is in [`add-buffer.lua`](../scripts/spans/add-buffer.lua).
Redis keeps the content of a segment and its structure in a few keys described
later.

Span payloads are stored in **payload keys**. The Python code writes payloads
to these keys before invoking the Lua script. The Lua script receives only
the span IDs of a `Subsegment` and:

1. Assigns them to the right segment by traversing the tree to the root or what
   we assume the root of the tree is at the moment the script is invoked. As
   we receive spans out of order we may receive the leaves before the root of
   the tree. We traverse the tree each time as high as we can
2. Updates the redirect table so future spans can find the segment root.
3. Merges **member-keys indexes** into the current segment root. This happens in two passes:
   - **Child spans**: For each span ID in the subsegment (except the parent),
     if it was previously a segment root with its own member-keys index or
     counters, those are merged into the current root and the old keys are
     deleted.
   - **Parent span**: If the parent span ID redirects to a different root
     (i.e. it is not the segment root itself), its member-keys are also merged
     into the new root.

**Redirect set**

```
span-buf:ssr:{PROJECT_AND_TRACE}

Example:
- 3 segments a,b,c
- Segment a has parent_span_id = B
- Segment b has parent_span_id = C
- Segment C is the root
- Segment a contains span A, A1
- Segment b contains span B
- Segment c contains span C

my_project:my_trace_id:
    {
        C: C
        B: C
        A1: C
        A2: C
    }
```

This hash is needed to assign spans to segments no matter in which order they
arrive.

As new spans for a segments arrive they either

- are added to an existing segment by traversing the parent child relationship
  till we find the root of the segment
- represent a subtree that is higher in the segment with respect to the existing
  spans. In that case everything is merged and this hash is updated to represent
  the current state of the tree.

**Priority Queue**

This is a sorted set that contains the keys of the segments that we need to flush.
The score of each element is the timestamp the segment will expire at.

```
span-buf:q:{SHARD} or span-buf:q:{SLICE_ID}-{SHARD}
```

- The elements are segment keys, used to look up metadata and the member-keys index.
- This is used as a queue by the Flusher to find the oldest segment to be flushed.

## Flushing

The flusher runs as subprocesses within each consumer. Each shard maps to exactly one
subprocess and is flushed by exactly one subprocess. Since each partition/shard is owned
by at most one consumer, no two consumers can flush from the same queue.

Flushing happens in two steps:

1. `flush_segments`: reads segment keys from the queue via `ZRANGEBYSCORE`
   (segments past their flush deadline), looks up the member-keys index to
   discover payload keys, loads span payloads from each via `SSCAN`, and
   produces them to the `buffered-segments` Kafka topic.
2. `done_flush_segments`: cleans up Redis keys (`DELETE` metadata,
   `UNLINK` payload keys, `DELETE` member-keys index, `HDEL` redirect
   entries, `ZREM` the queue entry).

# GCP Log Analyzer Tool

The `gcp_log_analyzer.py` script queries and analyzes slow EVALSHA operations logged by the span buffer system. These logs are generated by [`buffer_logger.py`](buffer_logger.py) and track Redis operations that take longer than expected.

## Usage

### Basic Usage

Fetch logs from the last 60 minutes:

```bash
python -m sentry.spans.gcp_log_analyzer fetch --last-minutes 60
```

## Output Format

The tool outputs a table showing the top traces by cumulative latency:

```
Top Traces by Cumulative Latency

Project ID           Trace ID                            Total Latency   Operations  Log Entries   Duration
------------------------------------------------------------------------------------------------------------------------
1231231231231231     6a499a5de1f6e3b412adb0ef12345678      26,557 ms        2,303            1   0:00:00
2342344              fc8dc7a8bee64349960bbc9489876543           6 ms            6            1   0:00:00

Summary:
- Total traces: 2
- Total operations: 2,309
- Time range: 2026-02-03 18:54:36 to 2026-02-03 18:54:37
- Consumers: process-spans-6 (20 log entries)
```

## Log Format

The tool parses log entries with the following structure:

```json
{
  "timestamp": "2026-02-03T18:54:36.806983608Z",
  "jsonPayload": {
    "event": "spans.buffer.slow_evalsha_operations",
    "top_slow_operations": [
      "1231231231231231:6a499a5de1f6e3b412adb0ef12345678:2303:26557"
    ]
  },
  "labels": {
    "k8s-pod/consumer": "process-spans-6"
  }
}
```

Each entry in `top_slow_operations` follows the format:

```
{project_id}:{trace_id}:{count}:{cumulative_latency_ms}
```

## Authentication

The tool uses Google Cloud credentials. Ensure you have authenticated:

```bash
gcloud auth application-default login
```

Or set the credentials file path:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

## Environment Variables

- `GCP_PROJECT`: Default GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to GCP credentials file

# Backend CI Optimizations

Incremental optimizations to the backend test CI pipeline. Each entry describes what was done, why, any quirks, and measured results.

## Metrics Key

- **Wall clock**: total time from first shard start to last shard finish
- **Avg shard time**: mean duration across all shards (per-tier if applicable)
- **Max / Min**: slowest and fastest individual shard
- **Spread**: max - min (measures balance)
- **Runner-minutes**: sum of all shard durations (measures cost)

---

## Step 2: Service Classifier

**What:** Pytest plugin (`service_classifier.py`) that maps each test to its external service dependencies (Snuba, Kafka, Postgres, etc.).

**How:** Hybrid static + runtime detection:
- *Static* (collection time): Checks fixtures (`_requires_snuba`, `_requires_kafka`, etc.), class inheritance for Postgres, and a hardcoded file list for Bigtable.
- *Runtime* (test execution): Monkey-patches `socket.send`/`socket.sendall`, checks `getpeername()` port to detect actual Snuba traffic (port 1218).

**Why hybrid?** Pure static misses tests that call Snuba indirectly through application code without the `_requires_snuba` fixture. Pure runtime misses services configured by fixtures that don't always produce detectable socket calls (Kafka, Symbolicator).

**Quirks:**
- Bigtable detection is hardcoded by file path (4 files) — no fixture or runtime detection exists for it.
- Opt-in via `--classify-services` flag; zero overhead when disabled.
- Runs in a separate CI workflow (`classify-services.yml`), not during normal test execution.

**Output:** `test-service-classification.json` — consumed by `split-tests-by-tier.py` in later steps.

**Results:** N/A (tooling only, no impact on test execution time).

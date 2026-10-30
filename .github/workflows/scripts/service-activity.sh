#!/usr/bin/env bash
# Summarizes what Postgres and ClickHouse did since a UTC timestamp, to explain
# their CPU use during backend tests (see the resource monitor's per-container
# totals).
#
#   service-activity.sh 2026-01-01T00:00:00Z
set -u
since=$1

echo "== postgres (log_connections, log_autovacuum_min_duration=0)"
pg_log=$(docker logs --since "$since" postgres-postgres-1 2>&1)
echo "connections: $(grep -c 'connection authorized' <<<"$pg_log")"
echo "autovacuum runs: $(grep -c 'automatic vacuum' <<<"$pg_log")"
echo "autoanalyze runs: $(grep -c 'automatic analyze' <<<"$pg_log")"

echo "== clickhouse queries by kind"
ch() {
  docker exec snuba-clickhouse-1 clickhouse-client --format PrettyCompactMonoBlock --query "$1"
}
ch "SYSTEM FLUSH LOGS"
filter="event_time >= parseDateTimeBestEffort('$since')"
cpu="(ProfileEvents['UserTimeMicroseconds'] + ProfileEvents['SystemTimeMicroseconds']) / 1e6"
ch "SELECT query_kind, count() AS queries, round(sum($cpu), 1) AS cpu_s,
      round(sum(query_duration_ms) / 1e3, 1) AS wall_s
    FROM system.query_log WHERE type = 'QueryFinish' AND $filter
    GROUP BY query_kind ORDER BY cpu_s DESC"
echo "== clickhouse top queries by CPU"
ch "SELECT count() AS queries, round(sum($cpu), 1) AS cpu_s,
      substring(replaceRegexpAll(any(query), '[[:space:]]+', ' '), 1, 110) AS example
    FROM system.query_log WHERE type = 'QueryFinish' AND $filter
    GROUP BY normalized_query_hash ORDER BY cpu_s DESC LIMIT 15"
echo "== clickhouse part activity"
ch "SELECT event_type, count() AS events, round(sum(duration_ms) / 1e3, 1) AS wall_s
    FROM system.part_log WHERE $filter GROUP BY event_type ORDER BY events DESC"

echo "== kafka health"
docker inspect kafka-kafka-1 --format '{{json .State.Health}}' |
  jq -c '{Status, FailingStreak, last: .Log[-1]}'

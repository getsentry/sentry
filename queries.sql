SELECT (transform((arrayElement(tags.indexed_value, indexOf(tags.key, 9223372036854776020)) AS `_snuba_tags[9223372036854776020]`), [0], [9223372036854776039]) AS _snuba_transaction),

(divide(plus(countMergeIf(count, equals((metric_id AS _snuba_metric_id), multiIf(equals((if(equals((indexOf([toUInt64(4550791811956737)], (project_id AS _snuba_project_id)) AS _snuba_project_threshold_config_index), 0), 'duration', arrayElement(['lcp'], _snuba_project_threshold_config_index)) AS _snuba_project_threshold_config), 'lcp'), 9223372036854775911, 9223372036854775909)) AND equals((arrayElement(tags.indexed_value, indexOf(tags.key, 9223372036854776026)) AS `_snuba_tags[9223372036854776026]`), 9223372036854776031)), divide(countMergeIf(count, equals(_snuba_metric_id, multiIf(equals(_snuba_project_threshold_config, 'lcp'), 9223372036854775911, 9223372036854775909)) AND equals(`_snuba_tags[9223372036854776026]`, 9223372036854776032)), 2)), countMergeIf(count, equals(_snuba_metric_id, multiIf(equals(_snuba_project_threshold_config, 'lcp'), 9223372036854775911, 9223372036854775909)))) AS _snuba_apdex), _snuba_transaction
  FROM generic_metric_distributions_aggregated_local
 WHERE equals(granularity, 3)
   AND greaterOrEquals((timestamp AS _snuba_timestamp), toDateTime('2022-07-27T00:00:00', 'Universal'))
   AND less(_snuba_timestamp, toDateTime('2022-10-25T10:33:10', 'Universal'))
   AND in(_snuba_project_id, [4550791811956737])
   AND equals((org_id AS _snuba_org_id), 4550791811956736)
   AND in(_snuba_metric_id, [9223372036854775909, 9223372036854775911])
 GROUP BY _snuba_transaction
 ORDER BY _snuba_apdex ASC
 LIMIT 51
OFFSET 0

SELECT (arrayElement(tags.indexed_value, indexOf(tags.key, 9223372036854776020)) AS `_snuba_tags[9223372036854776020]`),(divide(plus((countMergeIf(count, equals((arrayElement(tags.indexed_value, indexOf(tags.key, 9223372036854776026)) AS `_snuba_tags[9223372036854776026]`), 9223372036854776031) AND in((metric_id AS _snuba_metric_id), [9223372036854775909])) AS `_snuba_e:transactions/satisfied@none`), divide((countMergeIf(count, equals(`_snuba_tags[9223372036854776026]`, 9223372036854776032) AND in(_snuba_metric_id, [9223372036854775909])) AS `_snuba_e:transactions/tolerated@none`), 2)), (countMergeIf(count, in(_snuba_metric_id, [9223372036854775909])) AS `_snuba_e:transactions/all@none`)) AS _snuba_apdex), _snuba_apdex
  FROM generic_metric_distributions_aggregated_local
 WHERE equals(granularity, 2)
   AND in(tuple(`_snuba_tags[9223372036854776020]`), tuple(tuple(10021)))
   AND in(`_snuba_tags[9223372036854776020]`, tuple(10021))
   AND equals((org_id AS _snuba_org_id), 4550791828733953)
   AND in((project_id AS _snuba_project_id), [4550791828733954])
   AND greaterOrEquals((timestamp AS _snuba_timestamp), toDateTime('2022-07-27T00:00:00', 'Universal'))
   AND less(_snuba_timestamp, toDateTime('2022-10-25T10:37:27', 'Universal'))
   AND in(_snuba_metric_id, [9223372036854775909])
 GROUP BY `_snuba_tags[9223372036854776020]`
 LIMIT 51
OFFSET 0


divide(plus(countMergeIf(count, equals((metric_id AS _snuba_metric_id), multiIf(equals((if(equals((indexOf([toUInt64(4550791811956737)], (project_id AS _snuba_project_id)) AS _snuba_project_threshold_config_index), 0), 'duration', arrayElement(['lcp'], _snuba_project_threshold_config_index)) AS _snuba_project_threshold_config), 'lcp'), 9223372036854775911, 9223372036854775909)) AND equals((arrayElement(tags.indexed_value, indexOf(tags.key, 9223372036854776026)) AS `_snuba_tags[9223372036854776026]`), 9223372036854776031)), divide(countMergeIf(count, equals(_snuba_metric_id, multiIf(equals(_snuba_project_threshold_config, 'lcp'), 9223372036854775911, 9223372036854775909)) AND equals(`_snuba_tags[9223372036854776026]`, 9223372036854776032)), 2)), countMergeIf(count, equals(_snuba_metric_id, multiIf(equals(_snuba_project_threshold_config, 'lcp'), 9223372036854775911, 9223372036854775909)))) AS _snuba_apdex), _snuba_transaction

divide(
    plus((countMergeIf(count, equals((arrayElement(tags.indexed_value, indexOf(tags.key, 9223372036854776026)) AS `_snuba_tags[9223372036854776026]`), 9223372036854776031) AND in((metric_id AS _snuba_metric_id), [9223372036854775909])) AS `_snuba_e:transactions/satisfied@none`), divide((countMergeIf(count, equals(`_snuba_tags[9223372036854776026]`, 9223372036854776032) AND in(_snuba_metric_id, [9223372036854775909])) AS `_snuba_e:transactions/tolerated@none`), 2)), (countMergeIf(count, in(_snuba_metric_id, [9223372036854775909])) AS `_snuba_e:transactions/all@none`)) AS _snuba_apdex), _snuba_apdex

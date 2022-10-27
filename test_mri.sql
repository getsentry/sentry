SELECT
  (
    divide(
      plus(
        countMergeIf(
          count,
          equals(
            (metric_id AS _snuba_metric_id),
            multiIf(
              equals(
                (
                  if(
                    equals(
                      (
                        indexOf(
                          [(
                            toUInt64(4550802406506498),
                            'bar_transaction'
                          ),
                          (
                            toUInt64(4550802406506498),
                            'foo_transaction'
                          ) ],
                          (
                            (project_id AS _snuba_project_id),
                            `_snuba_tags[9223372036854776020]`
                          )
                        ) AS _snuba_project_threshold_override_config_index
                      ),
                      0
                    ),
                    ('duration', 300),
                    arrayElement(
                      [('lcp', 600),
                      ('lcp', 600) ],
                      _snuba_project_threshold_override_config_index
                    )
                  ) AS _snuba_project_threshold_config
                ),
                'lcp'
              ),
              9223372036854775911,
              9223372036854775909
            )
          )
          AND equals(
            (
              arrayElement(
                tags.indexed_value,
                indexOf(tags.key, 9223372036854776026)
              ) AS `_snuba_tags[9223372036854776026]`
            ),
            9223372036854776031
          )
        ),
        divide(
          countMergeIf(
            count,
            equals(
              _snuba_metric_id,
              multiIf(
                equals(
                  _snuba_project_threshold_config,
                  'lcp'
                ),
                9223372036854775911,
                9223372036854775909
              )
            )
            AND equals(
              `_snuba_tags[9223372036854776026]`,
              9223372036854776032
            )
          ),
          2
        )
      ),
      countMergeIf(
        count,
        equals(
          _snuba_metric_id,
          multiIf(
            equals(
              _snuba_project_threshold_config,
              'lcp'
            ),
            9223372036854775911,
            9223372036854775909
          )
        )
      )
    ) AS _snuba_apdex
  ),
  _snuba_apdex
FROM
  generic_metric_distributions_aggregated_local

<BaseQuerySet [('bar_transaction', 4550802429116417, 600, 2), ('foo_transaction', 4550802429116417, 600, 2)]>

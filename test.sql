SELECT
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
                        [toUInt64(4550791811956737) ],
                        (project_id AS _snuba_project_id)
                      ) AS _snuba_project_threshold_config_index
                    ),
                    0
                  ),
                  'duration',
                  arrayElement(
                    [ 'lcp' ], _snuba_project_threshold_config_index
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
  )

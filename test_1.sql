SELECT
  divide(
    plus(
      (
        countMergeIf(
          count,
          equals(
            (
              arrayElement(
                tags.indexed_value,
                indexOf(tags.key, 9223372036854776026)
              ) AS `_snuba_tags[9223372036854776026]`
            ),
            9223372036854776031
          )
          AND in(
            (metric_id AS _snuba_metric_id),
            [9223372036854775909]
          )
        ) AS `_snuba_e:transactions/satisfied@none`
      ),
      divide(
        (
          countMergeIf(
            count,
            equals(
              `_snuba_tags[9223372036854776026]`,
              9223372036854776032
            )
            AND in(
              _snuba_metric_id, [9223372036854775909]
            )
          ) AS `_snuba_e:transactions/tolerated@none`
        ),
        2
      )
    ),
    (
      countMergeIf(
        count,
        in(
          _snuba_metric_id, [9223372036854775909]
        )
      ) AS `_snuba_e:transactions/all@none`
    )
  ) AS _snuba_apdex
)

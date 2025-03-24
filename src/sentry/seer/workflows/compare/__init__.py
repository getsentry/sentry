"""Port of the comparison workflow module in Seer."""

import itertools

from sentry.seer.workflows.compare.models import (
    AttributeDistributions,
    CompareCohortsConfig,
    CompareCohortsMeta,
    CompareCohortsRequest,
    StatsAttribute,
    StatsAttributeBucket,
    StatsCohort,
)
from sentry.seer.workflows.compare.processor import DataProcessor
from sentry.seer.workflows.compare.scorer import CohortsMetricsScorer


def suspect_attributes(
    baseline: list[tuple[str, list[tuple[str, float]]]],
    selection: list[tuple[str, list[tuple[str, float]]]],
    num_top_attrs: int,
    num_top_buckets: int,
    referrer: str,
) -> list[tuple[str, list[str], float]]:
    # Transform input types to seer types.
    req = CompareCohortsRequest(
        baseline=StatsCohort(
            totalCount=_compute_sum(baseline),
            attributeDistributions=_to_attr_dist(baseline),
        ),
        selection=StatsCohort(
            totalCount=_compute_sum(selection),
            attributeDistributions=_to_attr_dist(selection),
        ),
        config=CompareCohortsConfig(
            topKAttributes=num_top_attrs,
            topKBuckets=num_top_buckets,
        ),
        meta=CompareCohortsMeta(referrer=referrer),
    )

    # This is where the work is done.
    p = DataProcessor()
    s = CohortsMetricsScorer()
    scored_dataset = s.compute_metrics(p.prepare_cohort_data(req), req.config)

    # Transform output types from the seer type back to our type.
    return [
        (
            row["attribute_name"],
            list(itertools.islice(row["distribution_selection"].keys(), req.config.topKBuckets)),
            row["rrf_score"],
        )
        for _, row in scored_dataset.head(req.config.topKAttributes).iterrows()
    ]


def _to_attr_dist(dataset: list[tuple[str, list[tuple[str, float]]]]) -> AttributeDistributions:
    return AttributeDistributions(
        attributes=[
            StatsAttribute(
                attributeName=i[0],
                buckets=[
                    StatsAttributeBucket(attributeValue=j[0], attributeValueCount=j[1])
                    for j in i[1]
                ],
            )
            for i in dataset
        ]
    )


def _compute_sum(dataset: list[tuple[str, list[tuple[str, float]]]]) -> AttributeDistributions:
    return sum(sum(k[1] for k in i[1]) for i in dataset)

from typing import Any, List, TypedDict


class Row(TypedDict):
    span_op: str
    span_group: str
    transaction_count: int
    p95_self_time: float
    sample_event_id: str
    span_count: int
    period: str


class AugmentedData(Row):
    span_key: str
    relative_freq: float
    score: float


def span_analysis(data: List[Row]):

    # create a unique identifier for each span
    span_keys = [row["span_op"] + "," + row["span_group"] for row in data]

    # number of occurrences of a span/transaction
    count_col = [row["span_count"] for row in data]
    txn_count = [row["transaction_count"] for row in data]
    p95_self_time = [row["p95_self_time"] for row in data]

    # add in two new fields
    # 1. relative freq - the avg number of times a span occurs per transaction
    # 2. score - a nondescriptive metric to evaluate the span (relative freq * avg duration)
    relative_freq = [count_col[x] / txn_count[x] for x in range(len(count_col))]
    score_col = [relative_freq[x] * p95_self_time[x] for x in range(len(relative_freq))]

    data_frames: List[AugmentedData] = [
        {
            **data[i],
            "relative_freq": relative_freq[i],
            "score": score_col[i],
            "span_key": span_keys[i],
        }
        for i in range(len(data))
    ]

    # create two dataframes for period 0 and 1 and keep only the same spans in both periods
    span_data_p0 = {row["span_key"]: row for row in data_frames if row["period"] == "before"}
    span_data_p1 = {row["span_key"]: row for row in data_frames if row["period"] == "after"}

    all_keys = set(span_data_p0.keys()).union(span_data_p1.keys())

    # merge the dataframes to do span analysis
    problem_spans: List[Any] = []

    # Perform the join operation
    for key in all_keys:
        row1 = span_data_p0.get(key)
        row2 = span_data_p1.get(key)
        new_span = False
        score_delta = 0.0

        if row1 and row2:
            score_delta = row2["score"] - row1["score"]
            freq_delta = row2["relative_freq"] - row1["relative_freq"]
            duration_delta = row2["p95_self_time"] - row1["p95_self_time"]
        elif row2:
            score_delta = row2["score"]
            freq_delta = row2["relative_freq"]
            duration_delta = row2["p95_self_time"]
            new_span = True

        # We're only interested in span changes if they positively impacted duration
        if score_delta > 0:
            sample_event_id = row1 and row1["sample_event_id"] or row2 and row2["sample_event_id"]
            if not sample_event_id:
                continue

            problem_spans.append(
                {
                    "span_op": key.split(",")[0],
                    "span_group": key.split(",")[1],
                    "sample_event_id": sample_event_id,
                    "score_delta": score_delta,
                    "freq_before": row1["relative_freq"] if row1 else 0,
                    "freq_after": row2["relative_freq"] if row2 else 0,
                    "freq_delta": freq_delta,
                    "duration_delta": duration_delta,
                    "duration_before": row1["p95_self_time"] if row1 else 0,
                    "duration_after": row2["p95_self_time"] if row2 else 0,
                    "is_new_span": new_span,
                }
            )

    problem_spans.sort(key=lambda x: x["score_delta"], reverse=True)

    return problem_spans

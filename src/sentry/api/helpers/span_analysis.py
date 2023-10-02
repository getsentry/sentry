# example data = list of dictionaries

# data = [{'period': 1, 'k': 'browser', 'txn_count': 2978, 'sum_v': 2088325.678, 'count_v': 24069, 'avg_v': 86.76412306},
# {'period': 1, 'k': 'http.client', 'txn_count': 2978, 'sum_v': 13444332.97, 'count_v': 78114, 'avg_v': 172.1116953},
# {'period': 1, 'k': 'mark', 'txn_count': 2978, 'sum_v': 0, 'count_v': 5390, 'avg_v': 0},
# {'period': 1, 'k': 'pageload', 'txn_count': 2978, 'sum_v': 1853836.58, 'count_v': 2978, 'avg_v': 622.5106045},
# {'period': 1, 'k': 'paint', 'txn_count': 2978, 'sum_v': 0, 'count_v': 5151, 'avg_v': 0},
# {'period': 1, 'k': 'resource.css', 'txn_count': 2978, 'sum_v': 449854.7821, 'count_v': 8926, 'avg_v': 50.39825029}]


def span_analysis(data):

    # create a unique identifier for each span
    span_keys = [row["span_op"] + "," + row["span_group"] for row in data]

    # number of occurrences of a span/transaction
    count_col = [row["span_count"] for row in data]
    txn_count = [row["transaction_count"] for row in data]

    # total self time of a span
    sum_col = [row["total_span_self_time"] for row in data]

    # add in three new fields
    # 1. relative freq - the avg number of times a span occurs per transaction
    # 2. avg duration - average duration of a span (total self time / span count)
    # 3. score - a nondescriptive metric to evaluate the span (relative freq * avg duration)
    relative_freq = [count_col[x] / txn_count[x] for x in range(len(count_col))]
    avg_col = [sum_col[x] / count_col[x] for x in range(len(sum_col))]
    score_col = [relative_freq[x] * avg_col[x] for x in range(len(relative_freq))]

    for i in range(len(data)):
        row = data[i]
        row["relative_freq"] = relative_freq[i]
        row["score"] = score_col[i]
        row["avg_duration"] = avg_col[i]
        row["span_key"] = span_keys[i]

    # create two dataframes for period 0 and 1 and keep only the same spans in both periods
    span_data_p0 = {row["span_key"]: row for row in data if row["period"] == "before"}
    span_data_p1 = {row["span_key"]: row for row in data if row["period"] == "after"}

    all_keys = set(span_data_p0.keys()).union(span_data_p1.keys())

    # merge the dataframes to do span analysis
    problem_spans = []

    # Perform the join operation
    for key in all_keys:
        row1 = span_data_p0.get(key)
        row2 = span_data_p1.get(key)
        new_span = False

        if row1 and row2:
            score_delta = row2["score"] - row1["score"]
            freq_delta = row2["relative_freq"] - row1["relative_freq"]
            duration_delta = row2["avg_duration"] - row1["avg_duration"]
        elif row2:
            score_delta = row2["score"]
            freq_delta = row2["relative_freq"]
            duration_delta = row2["avg_duration"]
            new_span = True

        # We're only interested in span changes if they positively impacted duration
        if score_delta > 0:
            problem_spans.append(
                {
                    "span_op": key.split(",")[0],
                    "span_group": key.split(",")[1],
                    "sample_event_id": row1["sample_event_id"],
                    "score_delta": score_delta,
                    "freq_before": row1["relative_freq"],
                    "freq_after": row2["relative_freq"],
                    "freq_delta": freq_delta,
                    "duration_delta": duration_delta,
                    "duration_before": row1["avg_duration"],
                    "duration_after": row2["avg_duration"],
                    "is_new_span": new_span,
                }
            )

    problem_spans.sort(key=lambda x: x["score_delta"], reverse=True)

    return problem_spans

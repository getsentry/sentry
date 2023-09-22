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

    # get constant, removed, and new spans
    spans_before = {row["span_key"] for row in data if row["period"] == 0}
    spans_after = {row["span_key"] for row in data if row["period"] == 1}
    constant_spans = spans_before.intersection(spans_after)

    # TODO: Add logic to surface removed/new spans
    # removed_spans = [x for x in spans_before if x not in spans_after]
    # new_spans = [x for x in spans_after if x not in spans_before]

    # create two dataframes for period 0 and 1 and keep only the same spans in both periods

    span_data_p0 = {
        row["span_key"]: row
        for row in data
        if row["period"] == 0 and row["span_key"] in constant_spans
    }
    span_data_p1 = {
        row["span_key"]: row
        for row in data
        if row["period"] == 1 and row["span_key"] in constant_spans
    }

    # merge the dataframes to do span analysis
    problem_spans = []

    # Perform the join operation
    for key in span_data_p0.keys():
        row1 = span_data_p0[key]
        row2 = span_data_p1[key]

        # Merge the rows from df1 and df2 into a single dictionary and get the delta between period 0/1
        score_delta = (row2["score"] - row1["score"]) / row1["score"] if row1["score"] != 0 else 0
        freq_delta = (
            (row2["relative_freq"] - row1["relative_freq"]) / row1["relative_freq"]
            if row1["relative_freq"] != 0
            else 0
        )
        duration_delta = (
            (row2["avg_duration"] - row1["avg_duration"]) / row1["avg_duration"]
            if row1["avg_duration"] != 0
            else 0
        )

        problem_spans.append(
            {
                "span_op": key.split(",")[0],
                "span_group": key.split(",")[1],
                "sample_event_id": row1["sample_event_id"],
                "score_delta": score_delta,
                "freq_delta": freq_delta,
                "duration_delta": duration_delta,
            }
        )

    problem_spans.sort(key=lambda x: x["score_delta"], reverse=True)

    return problem_spans

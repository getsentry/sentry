# example data = list of dictionaries

# data = [{'period': 1, 'k': 'browser', 'txn_count': 2978, 'sum_v': 2088325.678, 'count_v': 24069, 'avg_v': 86.76412306},
# {'period': 1, 'k': 'http.client', 'txn_count': 2978, 'sum_v': 13444332.97, 'count_v': 78114, 'avg_v': 172.1116953},
# {'period': 1, 'k': 'mark', 'txn_count': 2978, 'sum_v': 0, 'count_v': 5390, 'avg_v': 0},
# {'period': 1, 'k': 'pageload', 'txn_count': 2978, 'sum_v': 1853836.58, 'count_v': 2978, 'avg_v': 622.5106045},
# {'period': 1, 'k': 'paint', 'txn_count': 2978, 'sum_v': 0, 'count_v': 5151, 'avg_v': 0},
# {'period': 1, 'k': 'resource.css', 'txn_count': 2978, 'sum_v': 449854.7821, 'count_v': 8926, 'avg_v': 50.39825029}]

import collections

def span_analysis(data):
    columns = list(data[0].keys())

    # add in two extra columns
    count_col = [row["count_v"] for row in data]
    txn_count = [row['txn_count'] for row in data]
    avg_col = [row['avg_v'] for row in data]
    sum_col = [row['sum_v'] for row in data]

    relative_freq = [count_col[x] / txn_count[x] for x in range(len(count_col))]
    score_col = [relative_freq[x] * avg_col[x] for x in range(len(relative_freq))]

    for i in range(len(data)):
        row = data[i]
        row['relative_freq'] = relative_freq[i]
        row['score'] = score_col[i]

    # get constant, removed, and new spans
    spans_before = [row['k'] for row in data if row['period'] == 0]
    spans_after = [row['k'] for row in data if row['period'] == 1]
    result = collections.Counter(spans_before) & collections.Counter(spans_after)
    constant_spans = list(result.elements())

    removed_spans = [x for x in spans_before if x not in spans_after]
    new_spans = [x for x in spans_after if x not in spans_before]

    # create two dataframes for period 0 and 1 and keep only the same spans in both periods

    span_data_p0 = [row for row in data if row['period'] == 0 and row['k'] in constant_spans]
    span_data_p1 = [row for row in data if row['period'] == 1 and row['k'] in constant_spans]

    # merge the dataframes to do span analysis

    span_analysis = []

    # Perform the join operation
    for row1 in span_data_p0:
        for row2 in span_data_p1:
            if row1['k'] == row2['k']:
                # Merge the rows from df1 and df2 into a single dictionary
                # print(row1, row2)
                row1["score_p1"] = row2["score"]
                row1["freq_p1"] = row2["relative_freq"]
                row1["avg_p1"] = row2["avg_v"]
                span_analysis.append(row1)

    for row in span_analysis:
        row['score_delta'] = (row["score_p1"] - row["score"]) / row["score"] if row['score'] != 0 else 0
        row['freq_delta'] = (row['freq_p1'] - row['relative_freq']) / row['relative_freq'] if row[
                                                                                                  'relative_freq'] != 0 else 0
        row['duration_delta'] = (row['avg_p1'] - row['avg_v']) / row['avg_v'] if row['avg_v'] != 0 else 0

    span_analysis.sort(key=lambda x: x['score_delta'], reverse=True)

    return span_analysis
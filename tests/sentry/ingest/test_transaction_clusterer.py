from sentry.ingest.transaction_clusterer.tree import TreeClusterer


def test_multi_fanout():
    clusterer = TreeClusterer(merge_threshold=3)
    transaction_names = [
        "/a/b0/c/d0/e",
        "/a/b0/c/d1/e",
        "/a/b0/c/d2/e",
        "/a/b1/c/d0/e",
        "/a/b1/c/d1/e/",
        "/a/b1/c/d2/e",
        "/a/b2/c/d0/e",
        "/a/b2/c/d1/e/",
        "/a/b2/c/d2/e",
        "/a/b2/c1/d2/e",
    ]
    clusterer.add_input(transaction_names)
    assert clusterer.get_rules() == ["/a/*/c/*/**", "/a/*/**"]


def test_single_leaf():
    clusterer = TreeClusterer(merge_threshold=2)
    transaction_names = [
        "/a/b1/c/",
        "/a/b2/c/",
    ]
    clusterer.add_input(transaction_names)
    assert clusterer.get_rules() == ["/a/*/**"]

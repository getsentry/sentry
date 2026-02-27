# Investigations

## Dashboard Widget Ordering Failures Under xdist

### The symptom

5 out of 22 shards failed, all in `OrganizationDashboardDetailsPutTest`. Widget ID assertions mismatched:

```
FAILED test_remove_widget_and_add_new - assert 41 == 44
FAILED test_reorder_widgets_has_no_effect - assert 27 == 25
```

### The wrong hypothesis

Duplicate key errors in postgres logs (`sentry_email_email_key`, `sentry_dashboard_organization_title_uniq`) led to investigating whether xdist workers shared the same Postgres database. Investigated `configure_split_db()` shallow copy, pytest-django's `_set_suffix_to_test_databases`, and `TEST.NAME` propagation. All turned out to be irrelevant — the duplicate key errors were from `initialize_app()` startup, not from test execution.

### The misleading grep

Searching for `order=` in the test file found lines 70 and 80 with `order=0` and `order=1`. These were assumed to be on `DashboardWidget` objects. They were actually on `DashboardWidgetQuery` objects (queries *within* a widget) — a different model created in the same `setUp` method with visually identical indentation.

### The actual root cause

`widget_1` and `widget_2` in `OrganizationDashboardDetailsTestCase.setUp()` were created without `order=`. `DashboardWidget.order` is `BoundedPositiveIntegerField(null=True)`, so both had `order=NULL`. `get_widgets()` uses `ORDER BY (order, id)`. PostgreSQL's ordering of NULL values is nondeterministic (heap scan order), so widget ordering varied depending on prior test activity within the worker session.

Under xdist with `--reuse-db` and `PYTHONHASHSEED=0`, the test distribution across shards is deterministic. The same 5 shards always got this test file with enough prior DB activity to scramble the NULL ordering. Without xdist, the test happened to pass due to a lucky heap layout.

### The fix

Added `order=0` to `widget_1` and `order=1` to `widget_2` in the parent `setUp`. Combined with the earlier fix of `order=2` and `order=3` on `widget_3` and `widget_4` in the child `setUp`, all widgets now have deterministic ordering.

### Lesson

Add diagnostic output early. The debug print (`for w in widgets: print(f"id={w.id} order={w.order}")`) immediately showed `Widget 1 order=None` and resolved the issue in one iteration.

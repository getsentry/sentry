from tools.migrations.compare import _remove_set_compression, norm

_TABLE = """\
CREATE TABLE public.sentry_pullrequest_activity_log (
    data jsonb NOT NULL,
    id bigint NOT NULL
);
"""

_COMPRESSION = (
    "ALTER TABLE ONLY public.sentry_pullrequest_activity_log "
    "ALTER COLUMN data SET COMPRESSION lz4;\n"
)


def test_remove_set_compression_strips_only_compression() -> None:
    assert _remove_set_compression(_TABLE + _COMPRESSION) == _TABLE


def test_remove_set_compression_preserves_other_alter_table() -> None:
    other = "ALTER TABLE ONLY public.sentry_other ADD CONSTRAINT x PRIMARY KEY (id);\n"
    assert _remove_set_compression(other) == other


def test_norm_ignores_compression_only_difference() -> None:
    real = f"\\connect sentry\n{_TABLE}{_COMPRESSION}"
    state = f"\\connect sentry\n{_TABLE}"
    assert norm(real) == norm(state)

"""Tests for tools.migrations.compare module"""

from __future__ import annotations

import pytest

from tools.migrations.compare import analyze_differences


class TestIsPendingDeletionDrift:
    """Test detection of pending deletion drift patterns"""

    def test_only_removals_is_pending_deletion(self):
        """Drift with only removals (no additions) should be detected as pending deletion"""
        differences = [
            "--- REAL(dbname=sentry)\n",
            "+++ STATE(dbname=sentry)\n",
            "@@ -199,18 +199,6 @@\n",
            "-ALTER TABLE ONLY public.releases_commit\n",
            "-    ADD CONSTRAINT __c_fake__8c8464f4 PRIMARY KEY (id);\n",
            "-\n",
            "-CREATE INDEX releases_commit_author_id ON public.releases_commit;\n",
            "-\n",
            "-CREATE TABLE public.releases_commitfilechange (\n",
            "-    id bigint NOT NULL\n",
            "-);\n",
        ]
        assert analyze_differences(differences) == 0

    def test_with_additions_is_not_pending_deletion(self):
        """Drift with both removals and additions should NOT be pending deletion"""
        differences = [
            "--- REAL(dbname=sentry)\n",
            "+++ STATE(dbname=sentry)\n",
            "@@ -199,18 +199,6 @@\n",
            "-ALTER TABLE ONLY public.releases_commit\n",
            "+ALTER TABLE ONLY public.new_table\n",
            "-CREATE INDEX releases_commit_author_id ON public.releases_commit;\n",
        ]
        with pytest.raises(SystemExit):
            analyze_differences(differences)

    def test_only_additions_is_not_pending_deletion(self):
        """Drift with only additions (no removals) should NOT be pending deletion"""
        differences = [
            "--- REAL(dbname=sentry)\n",
            "+++ STATE(dbname=sentry)\n",
            "@@ -199,18 +199,6 @@\n",
            "+ALTER TABLE ONLY public.new_table\n",
            "+    ADD CONSTRAINT __c_fake__8c8464f4 PRIMARY KEY (id);\n",
            "+\n",
            "+CREATE INDEX new_table_author_id ON public.new_table;\n",
        ]
        with pytest.raises(SystemExit):
            analyze_differences(differences)

    def test_no_differences(self):
        """Empty diff should not be detected as pending deletion"""
        with pytest.raises(SystemExit):
            analyze_differences([])

    def test_only_headers(self):
        """Diff with only headers (no actual changes) should not be pending deletion"""
        differences = [
            "--- REAL(dbname=sentry)\n",
            "+++ STATE(dbname=sentry)\n",
        ]
        with pytest.raises(SystemExit):
            analyze_differences(differences)

    def test_with_context_lines(self):
        """Context lines should not affect detection"""
        differences = [
            "--- REAL(dbname=sentry)\n",
            "+++ STATE(dbname=sentry)\n",
            "@@ -199,18 +199,6 @@\n",
            " ALTER TABLE ONLY public.prevent_ai_configuration\n",
            "     ADD CONSTRAINT __c_fake__937e7a96 FOREIGN KEY;\n",
            " \n",
            "-ALTER TABLE ONLY public.releases_commit\n",
            "-    ADD CONSTRAINT __c_fake__8c8464f4 PRIMARY KEY (id);\n",
            " \n",
            " ALTER TABLE ONLY public.replays_replaydeletionjob\n",
        ]
        assert analyze_differences(differences) == 0

    def test_with_ansi_red_colors(self):
        """ANSI color codes should not break detection - red for removals"""
        differences = [
            "\033[1m\033[31m--- REAL(dbname=sentry)\033[m\n",
            "\033[1m\033[32m+++ STATE(dbname=sentry)\033[m\n",
            "@@ -199,18 +199,6 @@\n",
            "\033[31m-ALTER TABLE ONLY public.releases_commit\033[m\n",
            "\033[31m-    ADD CONSTRAINT __c_fake__8c8464f4 PRIMARY KEY (id);\033[m\n",
            "\033[31m-\033[m\n",
            "\033[31m-CREATE INDEX releases_commit_author_id ON public.releases_commit;\033[m\n",
        ]
        assert analyze_differences(differences) == 0

    def test_with_ansi_colors_mixed(self):
        """Mixed additions and removals with ANSI colors should NOT be pending deletion"""
        differences = [
            "\033[1m\033[31m--- REAL(dbname=sentry)\033[m\n",
            "\033[1m\033[32m+++ STATE(dbname=sentry)\033[m\n",
            "@@ -199,18 +199,6 @@\n",
            "\033[31m-ALTER TABLE ONLY public.releases_commit\033[m\n",
            "\033[32m+ALTER TABLE ONLY public.new_table\033[m\n",
        ]
        with pytest.raises(SystemExit):
            analyze_differences(differences)

    def test_multiple_table_deletions(self):
        """Multiple table deletions should be detected as pending deletion"""
        differences = [
            "--- REAL(dbname=sentry)\n",
            "+++ STATE(dbname=sentry)\n",
            "@@ -199,50 +199,6 @@\n",
            "-ALTER TABLE ONLY public.releases_commit\n",
            "-    ADD CONSTRAINT __c_fake__8c8464f4 PRIMARY KEY (id);\n",
            "-\n",
            "-ALTER TABLE ONLY public.releases_commit\n",
            "-    ADD CONSTRAINT __c_fake__a58b1726 UNIQUE (repository_id, key);\n",
            "-\n",
            "-ALTER TABLE ONLY public.releases_commitfilechange\n",
            "-    ADD CONSTRAINT __c_fake__0697c374 UNIQUE (commit_id, filename);\n",
            "-\n",
            "-ALTER TABLE ONLY public.releases_commitfilechange\n",
            "-    ADD CONSTRAINT __c_fake__8c8464f4 PRIMARY KEY (id);\n",
            "-\n",
            "-CREATE INDEX releases_co_author__3d0b29_idx ON public.releases_commit;\n",
            "-CREATE INDEX releases_co_organiz_bcc54e_idx ON public.releases_commit;\n",
            "-CREATE INDEX releases_commitfilechange_commit_id ON public.releases_commitfilechange;\n",
            "-\n",
            "-CREATE TABLE public.releases_commit (\n",
            "-    id bigint NOT NULL\n",
            "-);\n",
            "-\n",
            "-CREATE TABLE public.releases_commitfilechange (\n",
            "-    id bigint NOT NULL\n",
            "-);\n",
        ]
        assert analyze_differences(differences) == 0

    def test_real_world_pending_deletion_example(self):
        """Real example from the releases_commit/releases_commitfilechange deletion"""
        # This is a simplified version of the actual drift seen in CI
        differences = [
            "--- REAL(dbname=sentry)\n",
            "+++ STATE(dbname=sentry)\n",
            "@@ -199,18 +199,6 @@\n",
            " ALTER TABLE ONLY public.prevent_ai_configuration\n",
            "     ADD CONSTRAINT __c_fake__937e7a96 FOREIGN KEY (organization_id);\n",
            " \n",
            "-ALTER TABLE ONLY public.releases_commit\n",
            "-    ADD CONSTRAINT __c_fake__8c8464f4 PRIMARY KEY (id);\n",
            "-\n",
            "-ALTER TABLE ONLY public.releases_commit\n",
            "-    ADD CONSTRAINT __c_fake__a58b1726 UNIQUE (repository_id, key);\n",
            "-\n",
            "-ALTER TABLE ONLY public.releases_commitfilechange\n",
            "-    ADD CONSTRAINT __c_fake__0697c374 UNIQUE (commit_id, filename);\n",
            "-\n",
            " ALTER TABLE ONLY public.replays_replaydeletionjob\n",
            "     ADD CONSTRAINT __c_fake__8c8464f4 PRIMARY KEY (id);\n",
        ]
        assert analyze_differences(differences) == 0

    def test_schema_modification_is_not_pending_deletion(self):
        """Schema modifications (not just deletions) should not be pending deletion"""
        differences = [
            "--- REAL(dbname=sentry)\n",
            "+++ STATE(dbname=sentry)\n",
            "@@ -199,6 +199,6 @@\n",
            "-    column_name character varying(200) NOT NULL,\n",
            "+    column_name character varying(255) NOT NULL,\n",
        ]
        with pytest.raises(SystemExit):
            analyze_differences(differences)

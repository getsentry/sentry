# AI Codeathon 2026 - Project Ideas

Brainstormed project ideas for the Feb 17-19 codeathon. Theme: using AI to improve internal dev processes.

---

## 1. Auto Demo Generator

A tool that takes a feature description and automatically produces a demo video with voiceover. Uses Playwright for browser recording, ElevenLabs for TTS, FFmpeg for stitching. Staged: script generation → voiceover → final video. Can demo itself.

**Status**: In progress (wedamija)

---

## 2. Flaky Time-Dependent Test Detector

AST-based scanner + flake8 lint rule that finds production code using `time.time()`, `datetime.utcnow()`, or `datetime.now()` — patterns that cause flaky tests when combined with `time_machine` freezing. Auto-fixes violations. ~15 production files affected, 787 time-mocking occurrences across 196 test files.

---

## 3. Factory Violation Auto-Fixer

5,142 `.objects.create()` calls in tests violate the documented "use factories" rule. AI reads the factory API (2,819 lines) and contextually rewrites each violation to use the correct factory method. Ships a lint rule to prevent new violations.

---

## 4. Feature Flag Graveyard Cleaner

Scanner that cross-references 150+ temporary flag registrations against `features.has()` call sites. Finds dead flags (registered but never checked), ghost flags (checked but not registered), and stale flags (unchanged for 6+ months). Generates cleanup PRs.

**Status**: In progress (wedamija)

---

## 5. Technical Debt Auto-Tracker

Harvests 150+ TODO/FIXME/HACK/XXX comments, uses an LLM to parse natural-language trigger conditions ("remove in 9.1", "once we migrate off X"), evaluates whether conditions are met, and auto-files GitHub issues with team labels.

---

## 6. Test Parametrize Auto-Converter

Detects structurally similar test methods (same assertion pattern, different data) and converts them to `@pytest.mark.parametrize`. Only 491 parametrize uses across 27,000 tests. Top targets: files with 50-79 tests and zero parametrize.

---

## 7. Silo Test Decorator Auto-Applier

Only 52 API endpoint tests have `@region_silo_test`/`@control_silo_test`. 1,300+ tests lack them. Analyzer reads endpoint silo mode and auto-applies the matching test decorator. Ships a CI check preventing new tests without decorators.

---

## 8. CODEOWNERS Health Analyzer

Analyzes 746-line CODEOWNERS against git history to find: stale ownership (listed team hasn't touched code in 6+ months), gaps (files not covered), and drift (actual committers don't match listed owners). Generates suggested updates with visualizations.

---

## 9. Dead Code Cemetery

Cross-reference analyzer finding unused functions/classes, stale plugin directories (untouched 1+ years), `pass` stubs in tasks, and 144 `# type: ignore` comments that may be stale. Generates safe removal PRs with confidence scores.

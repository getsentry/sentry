# Number Formatting Audit

Audit of all number formatting/rendering utilities in the Sentry frontend, organized by data type.
Each entry shows the function signature, the rounding/precision logic, and concrete I/O examples.

---

## Duration

### `getDuration(seconds, fixedDigits?, abbreviation?, extraShort?, absolute?, minimumUnit?)`

[getDuration.tsx](getDuration.tsx) · Picks the largest fitting unit (year → microsecond) and formats using `value.toFixed(fixedDigits)`. `fixedDigits` defaults to **0** (whole numbers). Supports three label modes: long (`"3 seconds"`), abbreviated (`"3s"`/`"3sec"`), and extra-short (`"3s"`). Negative values are preserved unless `absolute=true`. `minimumUnit` forces a floor unit (e.g. 55 s with `minimumUnit=MINUTE` → `"1 minute"`).

| Input (seconds) | `fixedDigits` | Options              | Output            |
| --------------- | ------------- | -------------------- | ----------------- |
| `0.001`         | `0`           | —                    | `"1 millisecond"` |
| `0.001`         | `0`           | `abbreviation=true`  | `"1ms"`           |
| `1.5`           | `0`           | —                    | `"2 seconds"`     |
| `1.5`           | `1`           | —                    | `"1.5 seconds"`   |
| `65`            | `0`           | —                    | `"1 minute"`      |
| `65`            | `1`           | —                    | `"1.1 minutes"`   |
| `3601`          | `0`           | —                    | `"1 hour"`        |
| `3601`          | `2`           | —                    | `"1.00 hours"`    |
| `86400`         | `0`           | `extraShort=true`    | `"1d"`            |
| `-60`           | `0`           | —                    | `"-1 minute"`     |
| `-60`           | `0`           | `absolute=true`      | `"1 minute"`      |
| `55`            | `0`           | `minimumUnit=MINUTE` | `"1 minute"`      |

---

### `getExactDuration(seconds, abbreviation?, precision?)`

[getExactDuration.tsx](getExactDuration.tsx) · Decomposes the full duration into every applicable unit and shows them all. Uses `lodash/round` + integer arithmetic (`Math.floor`/`Math.ceil`). **No fractional display** — each component is a whole number. `precision` truncates output at a given suffix level.

| Input (seconds) | Options             | Output                             |
| --------------- | ------------------- | ---------------------------------- |
| `3661`          | —                   | `"1 hour 1 minute 1 second"`       |
| `90061`         | —                   | `"1 day 1 hour 1 minute 1 second"` |
| `3661`          | `abbreviation=true` | `"1hr 1min 1s"`                    |
| `0.294`         | —                   | `"294 milliseconds"`               |
| `5115`          | `precision="min"`   | `"1 hour 25 minutes"`              |

---

### `formatSecondsToClock(seconds, {padAll?})`

[formatSecondsToClock.tsx](static/app/utils/duration/formatSecondsToClock.tsx) · Clock display (`H:MM:SS` or `HH:MM:SS`). Rounds to the nearest integer millisecond via `lodash/round`. Appends `.mmm` if milliseconds remain. Zero/NaN → `"0:00"`.

| Input (seconds) | Options       | Output          |
| --------------- | ------------- | --------------- |
| `0`             | —             | `"0:00"`        |
| `65`            | —             | `"1:05"`        |
| `3661`          | —             | `"1:01:01"`     |
| `3661.294`      | —             | `"1:01:01.294"` |
| `65`            | `padAll=true` | `"01:05"`       |

---

### `formatDuration({duration, precision, style})`

[formatDuration.tsx](static/app/utils/duration/formatDuration.tsx) · Multi-format duration renderer. `Math.floor` for clock/ISO8601 decomposition; raw division for `count` style. Accepts any `[value, unit]` pair and converts to the target `precision` unit.

| Input                      | `style`         | Output          |
| -------------------------- | --------------- | --------------- |
| `[3661, 'second']`         | `'h:mm:ss'`     | `"1:01:01"`     |
| `[3661, 'second']`         | `'hh:mm:ss'`    | `"01:01:01"`    |
| `[3661294, 'millisecond']` | `'h:mm:ss.sss'` | `"1:01:01.294"` |
| `[3661, 'second']`         | `'ISO8601'`     | `"PT1H1M1S"`    |
| `[3661, 'second']`         | `'count'`       | `"3661"`        |

---

### `formatTraceDuration(duration_ms, precision?)`

[formatTraceDuration.tsx](static/app/utils/duration/formatTraceDuration.tsx) · GC-friendly single-unit formatter for the trace view. Picks the best unit (ms/s/m/h/d) and formats with `value.toFixed(precision)`. Default **2 decimal places**. Returns `"0ms"` for `<= 0`.

| Input (ms) | `precision` | Output       |
| ---------- | ----------- | ------------ |
| `0`        | `2`         | `"0ms"`      |
| `500`      | `2`         | `"500.00ms"` |
| `1500`     | `2`         | `"1.50s"`    |
| `90000`    | `2`         | `"1.50m"`    |
| `1500`     | `0`         | `"2s"`       |

---

### `axisDuration(milliseconds, durationUnit?)`

[axisDuration.tsx](static/app/utils/duration/axisDuration.tsx) · Y-axis label formatter. Always **0 decimal places** (`toFixed(0)`) — intentionally sacrifices sub-unit accuracy for consistent label sizing. Returns `"0"` for zero (no unit suffix).

| Input (ms) | Output    |
| ---------- | --------- |
| `0`        | `"0"`     |
| `500`      | `"500ms"` |
| `1500`     | `"2s"`    |
| `90000`    | `"2min"`  |
| `7200000`  | `"2h"`    |

---

### `formatYAxisDuration(milliseconds)`

[formatYAxisDuration.tsx](static/app/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisDuration.tsx) · Dashboard widget Y-axis. Divides by the chosen unit multiplier then calls `toLocaleString()` with no explicit precision. Trusts ECharts to supply round axis values. Covers year/month/week/day/hr/min/s/ms/μs/ns.

| Input (ms) | Output    |
| ---------- | --------- |
| `1000`     | `"1s"`    |
| `60000`    | `"1min"`  |
| `3600000`  | `"1h"`    |
| `500`      | `"500ms"` |

---

## Percentage

### `formatPercentage(value, places?, options?)`

[formatPercentage.tsx](formatPercentage.tsx) · General-purpose percentage formatter. Input is a **fraction (0–1)**; multiplied by 100 before display. Uses `lodash/round(value * 100, places)` then `toLocaleString`. Default **2 decimal places**. `0` fast-paths to `"0%"`. Values at or below `minimumValue` are shown as `<N%`.

| Input    | `places` | `minimumValue` | Output     |
| -------- | -------- | -------------- | ---------- |
| `0`      | —        | —              | `"0%"`     |
| `0.5`    | —        | —              | `"50%"`    |
| `0.1234` | —        | —              | `"12.34%"` |
| `0.1234` | `0`      | —              | `"12%"`    |
| `0.1234` | `1`      | —              | `"12.3%"`  |
| `0.0001` | `2`      | `0.001`        | `"<0.1%"`  |
| `null`   | —        | —              | `"0%"`     |

---

### `formatPercent(value)` (dynamic sampling)

[formatPercent.tsx](static/app/views/settings/dynamicSampling/utils/formatPercent.tsx) · Input is already a **percentage (0–100)**. Uses `Math.round(value * 100 * 100) / 100` as a guard against floating-point drift (e.g. `89.9999 → 90`), then `formatFloat` which **truncates** (not rounds) to **2 decimal places**.

| Input     | Output                     |
| --------- | -------------------------- |
| `50`      | `"50"`                     |
| `12.345`  | `"12.34"`                  |
| `89.9999` | `"90"` (round guard fires) |
| `0.1`     | `"0.1"`                    |

---

### `formatYAxisValue(value, 'percentage', ...)` / `formatTooltipValue(value, 'percentage', ...)`

[formatYAxisValue.tsx](static/app/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue.tsx) · Y-axis uses **3 dp** (`formatPercentage(value, 3)`); tooltip uses **2 dp** (`formatPercentage(value, 2)`).

| Input     | Context | Output      |
| --------- | ------- | ----------- |
| `0.1234`  | Y-axis  | `"12.34%"`  |
| `0.12345` | Y-axis  | `"12.345%"` |
| `0.12345` | Tooltip | `"12.35%"`  |

---

## Bytes / File Size

### `formatBytesBase2(bytes, fixPoints?)`

[formatBytesBase2.tsx](../bytes/formatBytesBase2.tsx) · **Recommended for storage/memory/file sizes** (Windows-style). Divides by 1024. `fixPoints` defaults to **1** decimal place, using `bytes.toFixed(fixPoints)`. Pass `fixPoints=false` for dynamic decimal display via `formatNumberWithDynamicDecimalPoints`.

| Input (bytes) | `fixPoints` | Output       |
| ------------- | ----------- | ------------ |
| `500`         | `1`         | `"500.0 B"`  |
| `1024`        | `1`         | `"1.0 KiB"`  |
| `1536`        | `1`         | `"1.5 KiB"`  |
| `1048576`     | `1`         | `"1.0 MiB"`  |
| `1536`        | `false`     | `"1.5 KiB"`  |
| `1536`        | `2`         | `"1.50 KiB"` |

---

### `formatBytesBase10(bytes, u?)`

[formatBytesBase10.tsx](../bytes/formatBytesBase10.tsx) · **Recommended for billing/attachment quotas**. Divides by 1000. Uses `formatNumberWithDynamicDecimalPoints` for up to **2 decimal places**, auto-scaling for sub-1 values. No trailing zeros.

| Input (bytes) | Output      |
| ------------- | ----------- |
| `500`         | `"500 B"`   |
| `1000`        | `"1 KB"`    |
| `1500`        | `"1.5 KB"`  |
| `1000000`     | `"1 MB"`    |
| `1234567`     | `"1.23 MB"` |
| `1000000000`  | `"1 GB"`    |

---

## Plain Numbers (counts, abbreviations)

### `formatFloat(number, places)`

[formatFloat.tsx](formatFloat.tsx) · Building block. **Truncates toward zero** (floor for positives) via `parseInt((n * 10^p).toString()) / 10^p`. Not a true round — no locale formatting.

| Input    | `places` | Output |
| -------- | -------- | ------ |
| `1.999`  | `1`      | `1.9`  |
| `1.001`  | `2`      | `1.0`  |
| `-1.999` | `1`      | `-1.9` |

---

### `formatNumberWithDynamicDecimalPoints(value, maxFractionDigits?)`

[formatNumberWithDynamicDecimalPoints.tsx](formatNumberWithDynamicDecimalPoints.tsx) · Core building block used by most other formatters. Default max **2 dp**. For values ≥ 1: up to `maxFractionDigits` decimals. For values < 1: auto-scales to always show at least one significant digit beyond the leading zeros (e.g. `0.0001234 → "0.00012"`). No trailing zeros.

| Input       | `maxFractionDigits` | Output       |
| ----------- | ------------------- | ------------ |
| `1234.5678` | `2`                 | `"1,234.57"` |
| `1.5`       | `2`                 | `"1.5"`      |
| `1.0`       | `2`                 | `"1"`        |
| `0.1234`    | `2`                 | `"0.12"`     |
| `0.001234`  | `2`                 | `"0.0012"`   |
| `0.0001234` | `2`                 | `"0.00012"`  |

---

### `formatAbbreviatedNumber(number, maximumSignificantDigits?, includeDecimals?)`

[formatters.tsx](../formatters.tsx) · K/M/B abbreviations. If `shortValue > 10` or evenly divisible → integer. Otherwise truncates (via `formatFloat`) to `maxSigDigits` (default **1**). Falls through to `toLocaleString` for numbers < 1 000.

| Input        | `maxSigDigits` | `includeDecimals` | Output    |
| ------------ | -------------- | ----------------- | --------- |
| `999`        | —              | —                 | `"999"`   |
| `1000`       | —              | —                 | `"1K"`    |
| `1500`       | —              | —                 | `"1.5K"`  |
| `15000`      | —              | —                 | `"15K"`   |
| `1234567`    | —              | —                 | `"1.2M"`  |
| `1234567`    | `3`            | —                 | `"1.23M"` |
| `1000000000` | —              | —                 | `"1B"`    |
| `-1500`      | —              | —                 | `"-1.5K"` |

---

### `formatAbbreviatedNumberWithDynamicPrecision(value)`

[formatters.tsx](../formatters.tsx) · Like `formatAbbreviatedNumber` but computes `maximumSignificantDigits` dynamically as `numFormattedDigits + 2`, aiming to show ~2 significant digits beyond the leading digit. Forces `includeDecimals=true` so decimals are never omitted.

| Input     | Output    |
| --------- | --------- |
| `0`       | `"0"`     |
| `999`     | `"999"`   |
| `1000`    | `"1.00K"` |
| `1234`    | `"1.23K"` |
| `12345`   | `"12.3K"` |
| `123456`  | `"123K"`  |
| `1234567` | `"1.23M"` |

---

### `formatApdex(value)`

[formatApdex.tsx](formatApdex.tsx) · Always **3 decimal places**, using `Intl.NumberFormat` with `roundingMode: 'trunc'` (ES2023) — truncates, never rounds up. Special-cases `0` and `1` to show no decimals.

| Input    | Output                               |
| -------- | ------------------------------------ |
| `0`      | `"0"`                                |
| `1`      | `"1"`                                |
| `0.9999` | `"0.999"`                            |
| `0.1234` | `"0.123"`                            |
| `0.9995` | `"0.999"` (truncated, not `"1.000"`) |

---

### `formatYAxisValue(value, 'number'/'integer', ...)`

[formatYAxisValue.tsx](static/app/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue.tsx) · Integers → `formatAbbreviatedNumber`. Non-integers → `toLocaleString({maximumFractionDigits: 20})` (full precision, trusts ECharts to provide round values).

### `formatTooltipValue(value, 'number'/'integer', ...)`

[formatTooltipValue.tsx](static/app/views/dashboards/widgets/timeSeriesWidget/formatters/formatTooltipValue.tsx) · `toLocaleString({maximumFractionDigits: 4})`. If `0 < value < 0.0001`: switches to `{maximumSignificantDigits: 4}` to avoid `"0.0000"`.

| Input        | Context | Output                   |
| ------------ | ------- | ------------------------ |
| `12345`      | Y-axis  | `"12K"`                  |
| `1.5`        | Y-axis  | `"1.5"`                  |
| `1.23456789` | Y-axis  | `"1.23456789"`           |
| `1.23456`    | Tooltip | `"1.2346"`               |
| `0.00005`    | Tooltip | `"0.00005"` (4 sig figs) |

---

## Rate / Throughput

### `formatRate(value, unit?, options?)`

[formatters.tsx](../formatters.tsx) · Compact `Intl` notation with exactly **3 significant digits** (min and max = 3). Appends the rate unit label manually (not internationalized). `value === 0` → `"0/unit"`. Values at or below `minimumValue` → `"<N/unit"`.

| Input     | `unit` | `minimumValue` | Output        |
| --------- | ------ | -------------- | ------------- |
| `0`       | `/s`   | —              | `"0/s"`       |
| `1.234`   | `/s`   | —              | `"1.23/s"`    |
| `12345`   | `/min` | —              | `"12.3K/min"` |
| `0.0001`  | `/s`   | `0.001`        | `"<0.001/s"`  |
| `1000000` | `/s`   | —              | `"1.00M/s"`   |

---

### `formatYAxisValue(value, 'rate', unit)` / `formatTooltipValue(value, 'rate', unit)`

[formatYAxisValue.tsx](static/app/views/dashboards/widgets/timeSeriesWidget/formatters/formatYAxisValue.tsx) · Y-axis uses compact notation with up to **6 significant digits**. Tooltip delegates to `formatRate` (**3 sig figs**).

| Input      | Context | Output        |
| ---------- | ------- | ------------- |
| `1.234567` | Y-axis  | `"1.23457/s"` |
| `1.234`    | Tooltip | `"1.23/s"`    |

---

## Currency

### `formatDollars(value)`

[formatters.tsx](../formatters.tsx) · Prepends `$`, delegates to `formatAbbreviatedNumberWithDynamicPrecision`. SI suffix, no cent-level precision. Used for chart axis labels.

| Input     | Output     |
| --------- | ---------- |
| `0.5`     | `"$0.50"`  |
| `1000`    | `"$1.00K"` |
| `1234`    | `"$1.23K"` |
| `1000000` | `"$1.00M"` |

---

### `displayPrice({cents, formatBigNum?})` / `displayPriceWithCents({cents})` / `displayUnitPrice({cents})`

[amCheckout/utils.tsx](static/gsApp/views/amCheckout/utils.tsx) · Billing price display. Input is always in **cents**. Hardcoded `'en-US'` locale.

| Function                | Input (cents) | Output                  |
| ----------------------- | ------------- | ----------------------- |
| `displayPrice`          | `100`         | `"$1"`                  |
| `displayPrice`          | `150`         | `"$1.50"`               |
| `displayPrice`          | `100000`      | `"$1,000"`              |
| `displayPriceWithCents` | `150`         | `"$1.50"` (always 2 dp) |
| `displayUnitPrice`      | `1`           | `"$0.00001"` (5–7 dp)   |

---

## Rounding Method Reference

| Method                                      | Used In                                                                  | Behavior                                        |
| ------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------- |
| `lodash/round`                              | `formatPercentage`, `getExactDuration`, `formatSecondsToClock`           | Round half-away from zero                       |
| `Math.round`                                | `formatPercent` (pre-truncation guard)                                   | Round half-up                                   |
| `Math.floor` + `parseInt` truncation        | `formatFloat`, `formatAbbreviatedNumber`, `formatDuration` clock/ISO     | Truncate toward zero (floor for positives)      |
| `.toFixed(n)`                               | `formatTraceDuration`, `axisDuration`, `getDuration`, `formatBytesBase2` | JS spec: round half-up; forces exactly n digits |
| `Intl roundingMode: 'trunc'`                | `formatApdex`                                                            | Explicit truncation via `Intl`                  |
| `toLocaleString` w/ `maximumFractionDigits` | Most formatters                                                          | Browser-defined (usually round half-even)       |
| `notation: 'compact'`                       | `formatRate`, `formatYAxisValue` for rates                               | Compact SI with significant digit control       |

> **Gotcha:** `formatPercent` uses `Math.round` as a pre-truncation guard (to avoid `89.9999 → 89.99`), but the final step is still `formatFloat` which **truncates**, not rounds.

---

# How Formatters Are Actually Used in the UI

Audit of call-site patterns across `static/`. Numbers are approximate (test/spec files excluded).

## `getDuration` — ~74 call sites, 10+ distinct patterns

The most overloaded formatter in the codebase. The signature is `getDuration(seconds, fixedDigits?, abbreviation?, extraShort?, absolute?, minimumUnit?)` — 6 positional booleans/numbers — which leads to a lot of variation.

| Pattern                                   | Count  | What it produces                              | Where                                                                                                                                                           |
| ----------------------------------------- | ------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getDuration(x)`                          | **36** | `"5 minutes"`, `"1 hour"` (0 dp, long labels) | Alert rules (`Every %s`, `over %s`), detector config, automation frequency, uptime sidebar, timeSince delta text, archive action options                        |
| `getDuration(x / 1000, 2, true)`          | **17** | `"1.50s"` (2 dp, abbreviated)                 | Trace view rows & headers, insights tables (MCP, slow queries, Next.js SSR), web vitals detail panels, transaction summary, trace indicators, span general info |
| `getDuration(x, 0, true)`                 | **5**  | `"1s"`, `"5m"` (0 dp, abbreviated)            | Regression summary (before/after), web vitals panels when `value < 1`, timeline dateNavigation                                                                  |
| `getDuration(x, value < 1 ? 0 : 2, true)` | **3**  | `"0s"` / `"1.23s"`                            | Web vitals tables and meters — avoids `"0.00s"` for sub-1 values                                                                                                |
| `getDuration(x / 1000, 2)`                | **3**  | `"1.50 seconds"` (long)                       | Percentile chart tooltip, duration tooltip, discover cellAction                                                                                                 |
| `getDuration(x / 1000, 2, true, true)`    | **2**  | `"1.5s"` (extra-short)                        | AI span list, insights samples table                                                                                                                            |
| `getDuration(interval, 0, false, true)`   | **2**  | `"5m"` (extra-short, long labels fallthrough) | Release series interval labels in detectors                                                                                                                     |
| `getDuration(ms > 1000 ? 2 : 0, true)`    | **1**  | `"500ms"` or `"1.50s"`                        | `getPerformanceDuration` wrapper                                                                                                                                |
| `getDuration(x, 1)`                       | **1**  | `"5.0 minutes"`                               | Team resolution time chart tooltip                                                                                                                              |
| `getDuration(x, 1, true)`                 | **1**  | `"5.0m"`                                      | Team resolution time axis                                                                                                                                       |

**Observations:**

- The same underlying data (span duration in ms) is formatted **four different ways** across the app: `"1.50s"` (trace view), `"1.5s"` (AI span list), `"1.50 seconds"` (discover), `"1 second"` (alerts).
- The `value < 1 ? 0 : 2` conditional in web vitals is solving a real UX problem (avoiding `"0.00s"` for fractional seconds) that no other caller handles.
- Nobody uses `absolute` or `minimumUnit` in production code paths besides alert config (which sometimes passes `MONTH` as `minimumUnit` via test fixtures — no real usage).

---

## `formatPercentage` — ~37 call sites, 6 distinct patterns

| Pattern                                                  | Count  | What it produces          | Where                                                                                                                                                                                   |
| -------------------------------------------------------- | ------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatPercentage(x)`                                    | **17** | `"12.34%"` (default 2 dp) | Failure rates (EAP, transaction summary, cache miss), trend_percentage, release comparison, flamegraph tooltip, regression table, span profile, dashboard tooltip                       |
| `formatPercentage(x, 0)`                                 | **11** | `"12%"`                   | Tag frequency tables (tagExplorer, tagValueTable), breakdown bars legend, usage history (gsApp billing), release adoption, vitalPercents, latency chart legend, sidebar chart formatter |
| `formatPercentage(x, 2, {minimumValue: 0.0001})`         | **4**  | `"12.34%"` or `"<0.01%"`  | Insights error rate cells, mobile screens overview table, mobile screens utils                                                                                                          |
| `formatPercentage(x, 2)`                                 | **2**  | `"12.34%"` explicit       | MCP grouped error rate widget, `<PercentChange>` component                                                                                                                              |
| `formatPercentage(x, 3)`                                 | **1**  | `"12.345%"`               | Dashboard widget Y-axis                                                                                                                                                                 |
| `formatPercentage(x, 1)`                                 | **1**  | `"12.3%"`                 | Preprod app size savings indicator                                                                                                                                                      |
| `formatPercentage(x, undefined, {minimumValue: 0.0001})` | **1**  | `"12.34%"` or `"<0.01%"`  | Discover field renderer (passes `undefined` rather than the explicit default)                                                                                                           |

**Observations:**

- Most call sites skip `minimumValue` entirely, which means small error rates render as `"0%"` or `"0.0001%"` rather than `"<0.01%"`. The insights team has converged on `minimumValue: 0.0001`; other areas haven't.
- No call site passes `nullValue`. Everywhere else handles `null`/`undefined` upstream with ternaries (`row[field] ? formatPercentage(...) : '-'`).
- 11 places pass `places=0` as the only non-default argument — basically "show as integer".

---

## `formatAbbreviatedNumber` — ~56 call sites, only 2 patterns

| Pattern                         | Count   | What it produces           | Where                                                                                                                                                                                                                                                   |
| ------------------------------- | ------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatAbbreviatedNumber(x)`    | **~54** | `"1.2K"`, `"10M"`, `"999"` | Event/issue counts, user counts, commit counts, files-changed, sample counts, chart axis labels, histogram bars, cache miss counts, queues row counts, job counts, mobile builds count, release adoption, regression flamegraph, webvitals pageOverview |
| `formatAbbreviatedNumber(x, 2)` | **2**   | `"1.2K"` with 2 sig digits | Dynamic sampling projects table (both own-count and sampled-count)                                                                                                                                                                                      |

**Observations:**

- Near-universal pattern of just passing the raw number. The `maximumSignificantDigits` and `includeDecimals` parameters are almost never used.
- Behavior quirk: for `1011` → `"1K"` (drops decimals because `shortValue > 10` path kicks in), but `1500` → `"1.5K"`. Callers generally don't seem aware of this.

---

## `formatRate` — ~16 call sites

| Pattern                                                 | Count | What it produces                  | Where                                                                      |
| ------------------------------------------------------- | ----- | --------------------------------- | -------------------------------------------------------------------------- |
| `formatRate(x)`                                         | **9** | `"12.3/s"` (default 3 sig digits) | Various (spec-heavy — real call sites are mostly gsAdmin customerOverview) |
| `formatRate(x, unit as RateUnit)`                       | **2** | `"12.3/min"` etc.                 | Discover charts (tooltip + y-axis formatter)                               |
| `formatRate(x, rateUnit)`                               | **2** | Same                              | Discover chart variant, seer ASCII snapshot                                |
| `formatRate(x, unit, {minimumValue: 0.001})`            | **1** | `"<0.001/s"` or `"12.3/s"`        | Insights throughput cell                                                   |
| `formatRate(x, unit as RateUnit, {minimumValue: 0.01})` | **1** | `"<0.01/s"`                       | Discover field renderer                                                    |
| `formatRate(x, RateUnit.PER_MINUTE)`                    | **1** | `"12.3/min"`                      | Regression table                                                           |

**Observations:**

- **Inconsistent `minimumValue` thresholds:** Insights uses `0.001`, Discover uses `0.01`. Same type of data, different obfuscation point.
- No call site uses the `significantDigits` option — always the default 3.

---

## `formatBytesBase2` — ~17 call sites

| Pattern                      | Count   | What it produces           | Where                                                                                                                                                                                                       |
| ---------------------------- | ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatBytesBase2(x)`        | **~16** | `"1.0 MiB"` (default 1 dp) | Device memory/storage, GPU memory, app memory info, event size (JSON download label), screenshot size, cache item size, replay memory tooltip, span evidence, resource info (content length, transfer size) |
| `formatBytesBase2(value, 0)` | **1**   | `"1 MiB"` (0 dp, integer)  | Replay memory chart Y-axis                                                                                                                                                                                  |

**Observations:**

- The `fixPoints: false` option that enables dynamic precision is never used in practice.
- All callers accept the default trailing `.0` (`"16.0 GiB"`), which is visually noisy for whole-number memory sizes.

---

## `formatBytesBase10` — ~25 call sites

All call sites use defaults (no `u` parameter). Used for:

- **Preprod build sizes:** appSizeInsights, appSizeInsightsSidebarRow (savings, duplicates, minification), appSizeTreemap, appSizeCategories, buildDetailsMetricCards, buildComparison, sizeCompareItemDiffTable, labelUtils (install/download size, size diff)
- **Replay network:** request/response body sizes in sections.tsx
- **Releases:** mobile builds chart tooltip
- **Billing:** organizationStats `formatUsageWithUnits` (attachments)

Consistent usage, essentially one pattern.

---

## `formatDollars` — 5 direct call sites

| Where                                     | Context                                           | Notes                                                                      |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `currencyCell.tsx`                        | Insights AI agents cost columns                   | Normal usage                                                               |
| `formatLLMCosts`                          | LLM cost display with `<$0.01` threshold          | Wraps formatDollars                                                        |
| `attributes.tsx` (trace span EAP)         | Cost attributes (`gen_ai.usage.output_cost` etc.) | **Calls `+Number(value).toFixed(10)` first** to strip float noise — a hack |
| `formatYAxisValue` / `formatTooltipValue` | Dashboard widget currency type                    | Delegated dispatch                                                         |

**Observation:** The `toFixed(10)` trick in trace attributes suggests `formatDollars` doesn't handle floating-point precision well for small costs.

---

## `formatApdex` — 1 call site

Only used in `static/app/utils/discover/fieldRenderers.tsx` (discover table cell for the apdex column). Nowhere else in the app. The ES2023 `roundingMode: 'trunc'` is therefore only visible in discover.

---

## `formatAbbreviatedNumberWithDynamicPrecision` — 2 direct call sites

| Where                                     | Context                                |
| ----------------------------------------- | -------------------------------------- |
| `seerExplorer/hooks/useAsciiSnapshot.tsx` | ASCII chart rendering                  |
| `formatMetricUsingUnit`                   | Fallback for unrecognized metric units |

Plus always via `formatDollars`. The dedicated function is barely used directly — most of its reach is through `formatDollars`.

---

## `formatPercent` (dynamic sampling variant) — 4 call sites

All in `static/app/views/settings/dynamicSampling/`:

- `projectsPreviewTable.tsx`
- `samplingModeSwitchModal.tsx`
- `samplingBreakdown.tsx`
- `projectsEditTable.tsx`

Entirely contained in that one feature area. The truncation-after-rounding behavior (unique to this formatter) is invisible to the rest of the app.

---

## `formatNumberWithDynamicDecimalPoints` — internal-only

Not called directly from UI components — always via `formatBytesBase10`, `formatBytesBase2(x, false)` (unused), or `formatMetricUsingUnit`. One exception: `preprodBuildsDistributionTable.tsx:54` passes `(downloadCount, 0)` — which is essentially `toLocaleString()` with commas. That's the only direct UI usage.

---

## `formatSecondsToClock` — 2 call sites

Both in `useShareReplayAtTimestamp.tsx` (replay timestamp sharing). One pattern: `formatSecondsToClock(x, {padAll: false})`.

## `formatTraceDuration` — 3 call sites

All in the trace view renderer (`traceBar.tsx`, `trace.tsx`). Default `precision=2` or a dynamic `precision` param.

## `axisDuration` — 1 call site

Only `static/app/utils/discover/charts.tsx` (discover y-axis formatter for duration columns).

## `getExactDuration` — ~7 call sites

| Where                                                                      | Pattern                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| `gsApp/views/spikeProtection/spikeProtectionHistoryTable.tsx`              | `getExactDuration(duration, true)` (abbreviated) |
| `views/issueDetails/streamline/sidebar/metricDetectorTriggeredSection.tsx` | Default                                          |
| `views/detectors/components/details/metric/detect.tsx` (×2)                | Default                                          |
| `views/settings/project/projectKeys/details/keyRateLimitsForm.tsx` (×2)    | Default                                          |
| `components/duration.tsx`                                                  | Conditional via `<Duration exact>` prop          |

Used only where a full breakdown is desired (e.g., `"1 hour 25 minutes 15 seconds"` for an alert time window, not `"1.4 hours"`).

---

# Cross-Cutting Observations

### Duration is the most inconsistent

The same data (a span duration in ms) gets formatted **at least four ways** across the app:

| Context                            | Call                                | Output for 1523ms                                  |
| ---------------------------------- | ----------------------------------- | -------------------------------------------------- |
| Trace view bar label               | `formatTraceDuration(1523)`         | `"1.52s"`                                          |
| Trace row / most insights tables   | `getDuration(1.523, 2, true)`       | `"1.52s"`                                          |
| AI span list, sample table         | `getDuration(1.523, 2, true, true)` | `"1.5s"`                                           |
| Percentile chart tooltip, discover | `getDuration(1.523, 2)`             | `"1.52 seconds"`                                   |
| Alert rule config                  | `getDuration(1.523)`                | `"2 seconds"` (rounded to integer)                 |
| Web vitals meters                  | `getDuration(1.523, 2, true)`       | `"1.52s"` but `0.5 → "0s"` via `value < 1 ? 0 : 2` |

### Percentage `minimumValue` thresholds differ

- **Insights / Discover:** `0.0001` → `"<0.01%"`
- **Throughput rate cells:** `0.001` → `"<0.001/s"`
- **Discover error rate:** `0.01` → `"<0.01/s"`
- Most other places: no threshold, so tiny percentages show as `"0%"` or full decimals

### The "optional parameters that nobody passes" list

- `formatPercentage`: `nullValue` (0 real call sites)
- `formatAbbreviatedNumber`: `includeDecimals` (only via `formatAbbreviatedNumberWithDynamicPrecision`), `maximumSignificantDigits` (only dynamic sampling, n=2)
- `formatRate`: `significantDigits` (0 real call sites)
- `formatBytesBase2`: `fixPoints: false` dynamic mode (0 real call sites)
- `getDuration`: `absolute` (0 real call sites), `minimumUnit` (0 real call sites)

### Formatters that are basically one-offs

- `formatApdex` — 1 call site (discover)
- `formatSecondsToClock` — 2 call sites (replay share)
- `axisDuration` — 1 call site (discover y-axis)
- `formatTraceDuration` — 3 call sites (trace view only)
- `formatPercent` — 4 call sites (dynamic sampling only)
- `formatAbbreviatedNumberWithDynamicPrecision` (direct) — 2 call sites

### The two "default-only" champions

- `formatAbbreviatedNumber` — 96% of calls use bare `formatAbbreviatedNumber(value)`
- `formatBytesBase10` — 100% of calls use defaults

These are the functions whose signatures could be trimmed most aggressively without breaking call sites.

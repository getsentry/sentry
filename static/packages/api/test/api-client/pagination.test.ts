import { describe, expect, it, vi } from "vitest";
import {
  consumeCursorPage,
  decodePageCursor,
  fetchAllPages,
  type Page,
  paginate,
} from "../../src/api-client/pagination.ts";

const MAX_PAGES = 50;

/**
 * A list endpoint over rows 1..total with Sentry offset cursors,
 * `0:<offset>:<is_prev>`. It parses `is_prev` the way Sentry does, with
 * Python's `int()`, which reads any `0`s joined by single `_`s as 0.
 * `pageSize` makes it ignore `per_page`, as some endpoints do.
 */
function offsetEndpoint(total: number, pageSize?: number) {
  return vi.fn(
    async (
      perPage: number,
      cursor: string | undefined,
    ): Promise<Page<number[]>> => {
      const [, offsetText = "0", isPrev = "0"] = cursor?.split(":") ?? [];
      if (!/^0(?:_?0)*$/.test(isPrev)) {
        throw new Error(`Sentry would reject is_prev ${isPrev}`);
      }
      const offset = Number(offsetText);
      const size = pageSize ?? perPage;
      const end = Math.min(offset + size, total);
      const data = Array.from(
        { length: end - offset },
        (_, i) => offset + i + 1,
      );
      return end < total ? { data, nextCursor: `0:${end}:0` } : { data };
    },
  );
}

describe("paginate", () => {
  describe("limit-bounded walks", () => {
    it("splits a limit above one page evenly over the fewest requests", async () => {
      const endpoint = offsetEndpoint(1000);
      const result = await paginate(
        { limit: 201, maxPages: MAX_PAGES },
        endpoint,
      );

      expect(endpoint.mock.calls.map(([perPage]) => perPage)).toEqual([
        67, 67, 67,
      ]);
      expect(result.data).toHaveLength(201);
      expect(result.data.at(-1)).toBe(201);
    });

    it("makes one request for a limit within one page", async () => {
      const endpoint = offsetEndpoint(1000);
      const result = await paginate(
        { limit: 25, maxPages: MAX_PAGES },
        endpoint,
      );

      expect(endpoint.mock.calls).toEqual([[25, undefined]]);
      expect(result.data).toHaveLength(25);
    });

    it("returns no cursor once the endpoint is exhausted", async () => {
      const result = await paginate(
        { limit: 50, maxPages: MAX_PAGES },
        offsetEndpoint(30),
      );

      expect(result).toEqual({
        data: Array.from({ length: 30 }, (_, i) => i + 1),
        stoppedAtPageCap: false,
      });
      expect("nextCursor" in result).toBe(false);
    });
  });

  describe("resume-safe cursors", () => {
    it("encodes the SDK's remaining offset as a shared CLI bookmark", () => {
      const page = consumeCursorPage(
        { data: [1, 2], nextCursor: "0:2:0" },
        decodePageCursor("cli1~100~5~"),
      );

      expect(page.data).toEqual([]);
      expect(decodePageCursor(page.nextCursor)).toEqual({
        cursor: "0:2:0",
        skip: 3,
      });
    });

    it("resumes inside a page without repeating or skipping rows", async () => {
      // The endpoint ignores per_page and always returns 67 rows.
      const endpoint = offsetEndpoint(1000, 67);
      const first = await paginate(
        { limit: 30, maxPages: MAX_PAGES },
        endpoint,
      );
      const second = await paginate(
        { limit: 10, cursor: first.nextCursor, maxPages: MAX_PAGES },
        endpoint,
      );

      expect(first.data).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
      expect(second.data).toEqual(Array.from({ length: 10 }, (_, i) => i + 31));
    });

    it("returns cursors the API and older clients accept, resuming at or before the stop", async () => {
      const endpoint = offsetEndpoint(1000, 67);
      const { nextCursor } = await paginate(
        { limit: 30, maxPages: MAX_PAGES },
        endpoint,
      );

      // A client that sends the cursor unchanged gets the page from its
      // first row: row 1, which is at or before row 31.
      const raw = await endpoint(67, nextCursor);
      expect(raw.data[0]).toBeLessThanOrEqual(31);
    });
  });

  it("reuses the page size of a page-number cursor whatever the new limit", async () => {
    const endpoint = vi.fn().mockResolvedValue({
      data: Array.from({ length: 50 }, (_, i) => i),
      nextCursor: "50:2:0",
    });
    const result = await paginate(
      { limit: 10, cursor: "50:1:0", maxPages: MAX_PAGES },
      endpoint,
    );

    expect(endpoint.mock.calls).toEqual([[50, "50:1:0"]]);
    expect(result.data).toHaveLength(10);
  });

  it("stops at the page cap with a cursor that resumes after the last row", async () => {
    const endpoint = offsetEndpoint(10_000);
    const first = await paginate({ limit: 1000, maxPages: 3 }, endpoint);
    const second = await paginate(
      { limit: 1, cursor: first.nextCursor, maxPages: 3 },
      endpoint,
    );

    expect(endpoint).toHaveBeenCalledTimes(4);
    expect(first.stoppedAtPageCap).toBe(true);
    expect(first.data).toHaveLength(300);
    expect(second.data).toEqual([301]);
  });

  it("does not report the page cap when the limit was reached", async () => {
    const result = await paginate(
      { limit: 300, maxPages: 3 },
      offsetEndpoint(10_000),
    );

    expect(result.data).toHaveLength(300);
    expect(result.stoppedAtPageCap).toBe(false);
  });

  it("warns and restarts on an unreadable cli1~ cursor", async () => {
    const endpoint = vi.fn().mockResolvedValue({ data: [] });
    const warn = vi.fn();
    await paginate(
      { limit: 5, cursor: "cli1~101~0~abc", maxPages: MAX_PAGES, warn },
      endpoint,
    );

    expect(endpoint.mock.calls).toEqual([[5, undefined]]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("fetchAllPages", () => {
  const numbers = (data: unknown) =>
    Array.isArray(data) && data.every((item) => typeof item === "number")
      ? data
      : undefined;

  it("follows cursors and returns every validated row", async () => {
    const fetchPage = vi.fn((cursor: string | undefined) =>
      Promise.resolve(
        cursor ? { data: [3] } : { data: [1, 2], nextCursor: "2" },
      ),
    );

    expect(await fetchAllPages(fetchPage, numbers, MAX_PAGES)).toEqual({
      ok: true,
      items: [1, 2, 3],
    });
    expect(fetchPage.mock.calls).toEqual([[undefined], ["2"]]);
  });

  it.each([
    {
      reason: "invalid-page",
      page: () => ({ data: ["one"] }),
    },
    {
      reason: "repeated-cursor",
      page: () => ({ data: [1], nextCursor: "same" }),
    },
    {
      reason: "page-cap",
      page: (() => {
        let page = 0;
        return () => {
          page += 1;
          return { data: [1], nextCursor: String(page) };
        };
      })(),
    },
  ])(
    "fails instead of returning a partial list: $reason",
    async ({ reason, page }) => {
      expect(
        await fetchAllPages(() => Promise.resolve(page()), numbers, 3),
      ).toEqual({ ok: false, reason });
    },
  );
});

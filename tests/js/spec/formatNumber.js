describe("formatNumber", function() {
  it("handles billions", function() {
    expect(app.utils.formatNumber(1134134134)).toBe('1.1b');
  });

  it("handles millions", function() {
    expect(app.utils.formatNumber(1234134)).toBe('1.2m');
  });

  it("handles thousands", function() {
    expect(app.utils.formatNumber(5334)).toBe('5.3k');
  });

  it("removes decimals on large numbers", function() {
    expect(app.utils.formatNumber(533334)).toBe('533k');
    expect(app.utils.formatNumber(53334)).toBe('53k');
  });

  it("doesnt format small numbers", function() {
    expect(app.utils.formatNumber(15)).toBe('15');
  });
});

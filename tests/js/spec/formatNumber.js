describe("formatNumber", function() {
  it("handles billions", function() {
    expect(app.formatNumber(1134134134)).toBe('1.1b');
  });

  it("handles billions", function() {
    expect(app.formatNumber(1234134)).toBe('1.2m');
  });

  it("handles thousands", function() {
    expect(app.formatNumber(5334)).toBe('5.3k');
  });

  it("doesnt format small numbers", function() {
    expect(app.formatNumber(15)).toBe('15');
  });
});
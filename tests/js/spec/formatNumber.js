describe("formatNumber", function() {
  it("handles billions", function() {
    assert.strictEqual(app.utils.formatNumber(1134134134), '1.1b');
  });

  it("handles millions", function() {
    assert.strictEqual(app.utils.formatNumber(1234134), '1.2m');
  });

  it("handles thousands", function() {
    assert.strictEqual(app.utils.formatNumber(5334), '5.3k');
  });

  it("removes decimals on large numbers", function() {
    assert.strictEqual(app.utils.formatNumber(533334), '533k');
    assert.strictEqual(app.utils.formatNumber(53334), '53k');
  });

  it("doesnt format small numbers", function() {
    assert.strictEqual(app.utils.formatNumber(15), '15');
  });
});

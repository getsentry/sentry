describe("floatFormat", function() {
  it("does format two decimal places", function() {
    assert.strictEqual(app.utils.floatFormat(1.134, 2), 1.13);
  });

  it("does format one decimal places", function() {
    assert.strictEqual(app.utils.floatFormat(1.134, 1), 1.1);
  });
});

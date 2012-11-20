describe("floatFormat", function() {
  it("does format two decimal places", function() {
    expect(app.floatFormat(1.134, 2)).toBe(1.13);
  });

  it("does format one decimal places", function() {
    expect(app.floatFormat(1.134, 1)).toBe(1.1);
  });
});
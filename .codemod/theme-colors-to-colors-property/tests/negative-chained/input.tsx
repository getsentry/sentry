// Test that we don't transform already-transformed code
const color1 = theme.colors.gray100;
const color2 = theme.colors.blue500;

// Test non-theme objects
const myObj = {gray100: '#fff'};
const value = myObj.gray100; // Should NOT transform

// Test other theme properties that aren't colors
const space = theme.space;
const fontSize = theme.fontSize;
const borderRadius = theme.radius;

// String literals should NOT be transformed
const colorName = "gray100";
const anotherColor = 'gray500';
const cssClass = `color-gray200`;

// These should be transformed (not strings)
const actualColor = theme.gray300;

// More string cases
const config = {
  colorKey: "blue400",
  value: theme.blue400, // This should transform
};

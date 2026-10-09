export function getFunctionLabel(index: number) {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function getEquationLabel(index: number) {
  return `ƒ${index}`;
}

export function getVisualizeLabel(labelIndex: number, isEquation: boolean): string {
  return isEquation ? getEquationLabel(labelIndex) : getFunctionLabel(labelIndex);
}

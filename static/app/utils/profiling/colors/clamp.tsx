function isNumber(input: unknown): input is number {
  return typeof input === 'number' && !isNaN(input);
}

export function clamp(number: number, min?: number, max?: number): number {
  if (!isNumber(min) && !isNumber(max)) {
    throw new Error('Clamp requires at least a min or max parameter');
  }

  if (isNumber(min) && isNumber(max)) {
    return number < min ? min : number > max ? max : number;
  }

  if (isNumber(max)) {
    return number > max ? max : number;
  }

  if (isNumber(min)) {
    return number < min ? min : number;
  }

  throw new Error('Unreachable case detected');
}

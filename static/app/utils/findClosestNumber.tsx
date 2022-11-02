/**
 * Finds the closest match to the number from the provided numbers array
 */
export function findClosestNumber(number: number, numbersArray: number[]) {
  return numbersArray.reduce((previousBest: number, currentNumber) => {
    return Math.abs(currentNumber - number) < Math.abs(previousBest - number)
      ? currentNumber
      : previousBest;
  });
}

/**
 * Returns a function that produces an incrementing step number on each call.
 * This is useful for forms which have conditional sections that need to be numbered correctly.
 */
export function useStepCounter() {
  let counter = 0;

  const nextStep = () => {
    counter++;
    return counter;
  };

  return nextStep;
}

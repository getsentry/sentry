import {Fragment, useEffect, useRef, useState} from 'react';

import Step from './step';

type Props = {
  activeStep: number;
  steps: string[];
  renderStepContent: (stepIndex: number) => React.ReactNode;
  renderStepActions: (stepIndex: number) => React.ReactNode;
};

function Stepper({activeStep, steps, renderStepContent, renderStepActions}: Props) {
  const [stepHeights, setStepHeights] = useState<number[]>([]);

  useEffect(() => {
    calcStepContentHeights();
  }, []);

  const wrapperRef = useRef<HTMLDivElement>(null);

  function calcStepContentHeights() {
    const stepperElement = wrapperRef.current;
    if (stepperElement) {
      const newStepHeights = steps.map(
        (_step, index) => (stepperElement.children[index] as HTMLDivElement).offsetHeight
      );

      setStepHeights(newStepHeights);
    }
  }

  return (
    <div ref={wrapperRef}>
      {steps.map((step, index) => {
        const isActive = !stepHeights.length || activeStep === index;
        return (
          <Step
            key={step}
            label={step}
            activeStep={activeStep}
            isActive={isActive}
            height={!!stepHeights.length ? stepHeights[index] : undefined}
          >
            {isActive && (
              <Fragment>
                {renderStepContent(index)}
                {renderStepActions(index)}
              </Fragment>
            )}
          </Step>
        );
      })}
    </div>
  );
}

export default Stepper;

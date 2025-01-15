import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(GuidedSteps, story => {
  story('Default', () => (
    <Fragment>
      <p>
        To create a GuideStep component, you should use <JSXNode name="GuidedSteps" /> as
        the container and <JSXNode name="GuidedSteps.Step" /> as direct children.
      </p>
      <p>
        You have complete control over what to render in the step titles and step content.
        You may use <JSXNode name="GuidedSteps.StepButtons" /> to render the default
        back/next buttons, but can also render your own.
      </p>
      <SizingWindow display="block">
        <GuidedSteps>
          <GuidedSteps.Step title="Step 1 Title" stepKey="step-1">
            This is the first step.
            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>
          <GuidedSteps.Step title="Step 2 Title" stepKey="step-2">
            This is the second step.
            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>
          <GuidedSteps.Step title="Step 3 Title" stepKey="step-3" optional>
            This is the third step.
            <GuidedSteps.StepButtons />
          </GuidedSteps.Step>
        </GuidedSteps>
      </SizingWindow>
    </Fragment>
  ));

  story('Custom button behavior', () => {
    function SkipToLastButton() {
      const {setCurrentStep, totalSteps} = useGuidedStepsContext();
      return (
        <GuidedSteps.ButtonWrapper>
          <Button size="sm" onClick={() => setCurrentStep(totalSteps)}>
            Skip to Last Step
          </Button>
        </GuidedSteps.ButtonWrapper>
      );
    }

    return (
      <Fragment>
        <p>
          A hook is provided to access and control the step state:{' '}
          <code>useGuidedStepsContext()</code>. This can be used to create step buttons
          with custom behavior.
        </p>
        <SizingWindow display="block">
          <GuidedSteps>
            <GuidedSteps.Step title="Step 1 Title" stepKey="step-1">
              This is the first step.
              <SkipToLastButton />
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Step 2 Title" stepKey="step-2">
              This is the second step.
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Step 3 Title" stepKey="step-3">
              This is the third step.
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>
          </GuidedSteps>
        </SizingWindow>
      </Fragment>
    );
  });

  story('Controlling completed state', () => {
    return (
      <Fragment>
        <p>
          By default, previous steps are considered completed. However, if the completed
          state is known it can be controlled using the <code>isCompleted</code> property
          on <JSXNode name="GuidedSteps.Step" />. The GuidedStep component will begin on
          the first incomplete step.
        </p>
        <SizingWindow display="block">
          <GuidedSteps>
            <GuidedSteps.Step title="Step 1 Title" stepKey="step-1" isCompleted>
              Congrats, you finished the first step!
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Step 2 Title" stepKey="step-2" isCompleted={false}>
              You haven&apos;t completed the second step yet, here&apos;s how you do it.
              <GuidedSteps.ButtonWrapper>
                <GuidedSteps.BackButton />
              </GuidedSteps.ButtonWrapper>
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Step 3 Title" stepKey="step-3" isCompleted={false}>
              You haven&apos;t completed the third step yet, here&apos;s how you do it.
              <GuidedSteps.ButtonWrapper>
                <GuidedSteps.BackButton />
              </GuidedSteps.ButtonWrapper>
            </GuidedSteps.Step>
          </GuidedSteps>
        </SizingWindow>
      </Fragment>
    );
  });
});

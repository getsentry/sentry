import {createContext, Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import compassImage from 'sentry-images/spot/onboarding-compass.svg';

import {openModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {CodeBlock} from 'sentry/components/core/code';
import {Input} from 'sentry/components/core/input';
import {Flex} from 'sentry/components/core/layout';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  TourContextProvider,
  TourElement,
  type TourContextProviderProps,
} from 'sentry/components/tours/components';
import {StartTourModal, startTourModalCss} from 'sentry/components/tours/startTour';
import type {TourContextType} from 'sentry/components/tours/tourContext';
import {IconStar} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

const enum MyTour {
  NAME = 'my-tour-name',
  EMAIL = 'my-tour-email',
  PASSWORD = 'my-tour-password',
}
const ORDERED_MY_TOUR = [MyTour.NAME, MyTour.EMAIL, MyTour.PASSWORD];
const MyTourContext = createContext<TourContextType<MyTour> | null>(null);

function useMyTour(): TourContextType<MyTour> {
  const tourContext = useContext(MyTourContext);
  if (!tourContext) {
    throw new Error('Must be used within a TourContextProvider<MyTour>');
  }
  return tourContext;
}

export default Storybook.story('Tours', story => {
  story('Getting Started', () => (
    <Fragment>
      <p>
        Tours are a way to guide users through a series of steps around a page in the
        product, with anchored tooltips which may jump all over the page. By default the
        provider will blur everything on the page, only allowing the focused element and
        tour step to be visible.
      </p>
      <p>
        It can be closed with on each step, or with an 'escape' keypress. Using 'left/h'
        and 'right/l' keys will navigate between steps.
      </p>
      <TourProvider>
        <TourElement<MyTour>
          id={MyTour.NAME}
          title="Name Time!"
          description="This is the description of the name tour step."
          tourContext={MyTourContext}
        >
          <Input placeholder="Step 1: Name" />
        </TourElement>
        <TourElement<MyTour>
          id={MyTour.EMAIL}
          title="Email Time!"
          description="This is the description of the email tour step."
          tourContext={MyTourContext}
        >
          <Input placeholder="Step 2: Email" type="email" />
        </TourElement>
        <TourElement<MyTour>
          id={MyTour.PASSWORD}
          title="Password Time!"
          description="This is the description of the password tour step."
          tourContext={MyTourContext}
        >
          <Input placeholder="Step 3: Password" type="password" />
        </TourElement>
      </TourProvider>
    </Fragment>
  ));

  story('Setup', () => (
    <Fragment>
      <p>To setup a new tour, you need to do the following:</p>
      <ol>
        <li>Define the steps of the tour.</li>
        <li>Define the order of the steps.</li>
        <li>Create the tour context for the components to use.</li>
        <li>Create a usage hook to refine types.</li>
        <li>Add a tour key to save the viewed/dismissed status.</li>
      </ol>
      <CodeBlock language="tsx">
        {`import {createContext, useContext} from 'react';

import {TourElement, type TourElementProps} from 'sentry/components/tours/components';
import type {TourContextType} from 'sentry/components/tours/tourContext';

// Step 1. Define the steps of the tour.
const enum MyTour {
  NAME = 'my-tour-name',
  EMAIL = 'my-tour-email',
  PASSWORD = 'my-tour-password',
}

// Step 2. Define the order of the steps.
const ORDERED_MY_TOUR = [MyTour.NAME, MyTour.EMAIL, MyTour.PASSWORD];

// Step 3. Create the tour context for the components to use.
const MyTourContext = createContext<TourContextType<MyTour> | null>(null);

// Step 4. Create the usage hook to refine types.
function useMyTour(): TourContextType<MyTour> {
  const tourContext = useContext(MyTourContext);
  if (!tourContext) {
    throw new Error('Must be used within a TourContextProvider<MyTour>');
  }
  return tourContext;
}

// Step 5. Add a tour key to save the viewed/dismissed status.
// Note: This should match what's added to 'src/sentry/assistant/guides.py'.
export const MY_TOUR_KEY = 'tour.my_tour';

`}
      </CodeBlock>
    </Fragment>
  ));

  story('Usage', () => (
    <Fragment>
      <p>
        Now, to implement your tour, you need to wrap your components in the{' '}
        <Storybook.JSXNode name="TourContextProvider" /> and pass in the context, and
        ordered steps you created earlier.
      </p>
      <CodeBlock language="tsx">
        {`<TourContextProvider<MyTour>
  orderedStepIds={ORDERED_MY_TOUR}
  tourContext={MyTourContext}
  tourKey={MY_TOUR_KEY}
>
  {/* All focused elements in the tour should be within this provider */}
</TourContextProvider>`}
      </CodeBlock>

      <p>
        Now, you can use the <Storybook.JSXNode name="TourElement" /> component to wrap
        the component you wish to highlight.
      </p>
      <CodeBlock language="tsx">
        {`// Before...
<Input placeholder="Name" />

// After...
<TourElement<MyTour>
  tourContext={MyTourContext}
  id={MyTour.NAME}
  title={'Name Time!'}
  description={'We need this to make your account :)'}
>
  <Input placeholder="Name" />
</TourElement>
`}
      </CodeBlock>

      <p>
        Then, whenever you'd like to start your tour, just import your context and call
        `startTour()`.
      </p>
      <Alert variant="warning" showIcon={false}>
        <strong>Note:</strong> The tour will not start until all of the steps are present
        in the DOM! The <Storybook.JSXNode name="TourContextProvider" /> component you
        created earlier will be keeping track of this internally. You can check this with
        the
        <code>isRegistered</code> property of the context.
      </Alert>
      <br />
      <CodeBlock language="tsx">
        {`function StartMyTourButton() {
  const {startTour, isRegistered} = useMyTour();
  return (
    <Button
      onClick={() => startTour()}
      disabled={!isRegistered}
    >
      Start Tour
    </Button>
  );
}`}
      </CodeBlock>
      <br />
      <TourProvider>
        <TourElement<MyTour>
          tourContext={MyTourContext}
          id={MyTour.NAME}
          title="Name Time!"
          description="This is the description of the name tour step."
        >
          <Input placeholder="Step 1: Name" />
        </TourElement>
        <TourElement<MyTour>
          tourContext={MyTourContext}
          id={MyTour.EMAIL}
          title="Email Time!"
          description="This is the description of the email tour step."
        >
          <Input placeholder="Step 2: Email" type="email" />
        </TourElement>
        <div style={{height: '30px'}}>
          <LoadingIndicator mini />
        </div>
      </TourProvider>
    </Fragment>
  ));

  story('Customization', () => (
    <Fragment>
      <ul>
        <li>
          The default behavior is to blur the entire page, and only show the focused
          element and the tour step. You can avoid this with the <code>omitBlur</code>
          prop.
        </li>
        <li>You can also customize the look of the wrapper for the focused elements.</li>
      </ul>
      <TourProvider tourProviderProps={{omitBlur: true}}>
        <CustomTourElement
          tourContext={MyTourContext}
          id={MyTour.NAME}
          title="Name Time!"
          description="This is the description of the name tour step."
        >
          <Input placeholder="Step 1: Name" />
        </CustomTourElement>
        <CustomTourElement
          tourContext={MyTourContext}
          id={MyTour.EMAIL}
          title="Email Time!"
          description="This is the description of the email tour step."
        >
          <Input placeholder="Step 2: Email" type="email" />
        </CustomTourElement>
        <CustomTourElement
          tourContext={MyTourContext}
          id={MyTour.PASSWORD}
          title="Password Time!"
          description="This is the description of the password tour step."
        >
          <Input placeholder="Step 3: Password" type="password" />
        </CustomTourElement>
      </TourProvider>
    </Fragment>
  ));

  story('Multiple highlighted elements', () => (
    <Fragment>
      <p>
        Most of the time you'll want to highlight a single element. But if you need to
        highlight multiple elements, you can do so by using the same step ID for each
        element. Any that you do not want a tooltip for should pass null for the
        title/description.
      </p>
      <TourProvider>
        <TourElement<MyTour>
          id={MyTour.NAME}
          title={null}
          description={null}
          tourContext={MyTourContext}
        >
          <Input placeholder="Step 1: First Name" />
        </TourElement>
        <TourElement<MyTour>
          id={MyTour.NAME}
          title="Name Time!"
          description="Look at all these name inputs!"
          tourContext={MyTourContext}
          position="right"
        >
          <Input placeholder="Step 1: Middle Name" />
        </TourElement>
        <TourElement<MyTour>
          id={MyTour.NAME}
          title={null}
          description={null}
          tourContext={MyTourContext}
        >
          <Input placeholder="Step 1: Last Name" />
        </TourElement>
        <TourElement<MyTour>
          id={MyTour.EMAIL}
          title="Email Time!"
          description="This is the description of the email tour step."
          tourContext={MyTourContext}
        >
          <Input placeholder="Step 2: Email" type="email" />
        </TourElement>
        <TourElement<MyTour>
          id={MyTour.PASSWORD}
          title="Password Time!"
          description="This is the description of the password tour step."
          tourContext={MyTourContext}
        >
          <Input placeholder="Step 3: Password" type="password" />
        </TourElement>
      </TourProvider>
    </Fragment>
  ));

  story('Start Tour Modal', () => (
    <Fragment>
      <p>
        To show a modal to start the tour, you can use the{' '}
        <Storybook.JSXNode name="StartTourModal" /> component.
      </p>
      <Button
        onClick={() => {
          openModal(
            props => (
              <StartTourModal
                closeModal={props.closeModal}
                onDismissTour={() => {
                  // eslint-disable-next-line no-alert
                  window.alert('Tour dismissed');
                }}
                onStartTour={() => {
                  // eslint-disable-next-line no-alert
                  window.alert('Start Tour Clicked');
                }}
                header="Start Tour Modal"
                description="Take the tour to learn more about this page (if you dare)."
                img={{
                  src: compassImage,
                  alt: 'Onboarding Compass',
                }}
              />
            ),
            {
              modalCss: startTourModalCss,
            }
          );
        }}
      >
        Open Start Tour Modal
      </Button>
    </Fragment>
  ));
});

function StartTourButton() {
  const {startTour, isRegistered} = useMyTour();
  return (
    <Button icon={<IconStar />} onClick={() => startTour()} disabled={!isRegistered}>
      Start Tour
    </Button>
  );
}

function TourProvider({
  children,
  tourProviderProps = {},
}: {
  children: React.ReactNode;
  tourProviderProps?: Partial<TourContextProviderProps<MyTour>>;
}) {
  return (
    <Storybook.SizingWindow>
      <BlurBoundary>
        <TourContextProvider<MyTour>
          isCompleted={false}
          orderedStepIds={ORDERED_MY_TOUR}
          TourContext={MyTourContext}
          {...tourProviderProps}
        >
          <Flex gap="xl" align="center">
            <Flex gap="xl" justify="between" direction="column" align="start">
              <StartTourButton />
              {children}
            </Flex>
            <Image src={compassImage} />
            <p style={{maxWidth: '300px'}}>
              Lorem ipsum dolor, sit amet consectetur adipisicing elit. Qui nam doloremque
              repellendus, natus deserunt pariatur cupiditate fugiat adipisci,
              praesentium, quos autem tempora nostrum laborum voluptatum reiciendis quia
              veniam consequatur sapiente!
            </p>
          </Flex>
        </TourContextProvider>
      </BlurBoundary>
    </Storybook.SizingWindow>
  );
}

const BlurBoundary = styled('div')`
  position: relative;
  border: 1px dashed ${p => p.theme.tokens.border.accent.vibrant};
  padding: ${space(2)};
  margin: ${space(1)} ${space(2)};
`;

const Image = styled('img')`
  aspect-ratio: 1/1;
  height: 100%;
  object-fit: contain;
`;

const CustomTourElement = styled(TourElement<MyTour>)`
  &[aria-expanded='true']:after {
    box-shadow: 0 0 0 2px ${p => p.theme.tokens.border.accent.vibrant};
  }
`;

import {createContext, Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import compassImage from 'sentry-images/spot/onboarding-compass.svg';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Flex} from 'sentry/components/container/flex';
import {Alert} from 'sentry/components/core/alert';
import {Input} from 'sentry/components/core/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {
  TourContextProvider,
  type TourContextProviderProps,
  TourElement,
} from 'sentry/components/tours/components';
import type {TourContextType} from 'sentry/components/tours/tourContext';
import {IconStar} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';
import type {Color} from 'sentry/utils/theme';

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

export default storyBook('Tours', story => {
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
        <TourElement
          id={MyTour.NAME}
          title={'Name Time!'}
          description={'This is the description of the name tour step.'}
          tourContext={MyTourContext}
        >
          <Input placeholder="Step 1: Name" />
        </TourElement>
        <TourElement
          id={MyTour.EMAIL}
          title={'Email Time!'}
          description={'This is the description of the email tour step.'}
          tourContext={MyTourContext}
        >
          <Input placeholder="Step 2: Email" type="email" />
        </TourElement>
        <TourElement
          id={MyTour.PASSWORD}
          title={'Password Time!'}
          description={'This is the description of the password tour step.'}
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
      </ol>
      <CodeSnippet language="tsx">
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
`}
      </CodeSnippet>
    </Fragment>
  ));

  story('Usage', () => (
    <Fragment>
      <p>
        Now, to implement your tour, you need to wrap your components in the{' '}
        <JSXNode name="TourContextProvider" /> and pass in the context, and ordered steps
        you created earlier.
      </p>
      <CodeSnippet language="tsx">
        {`<TourContextProvider
  orderedStepIds={ORDERED_MY_TOUR}
  tourContext={MyTourContext}
>
  {/* All focused elements in the tour should be within this provider */}
</TourContextProvider>`}
      </CodeSnippet>

      <p>
        Now, you can use the <JSXNode name="TourElement" /> component to wrap the
        component you wish to highlight.
      </p>
      <CodeSnippet language="tsx">
        {`// Before...
<Input placeholder="Name" />

// After...
<TourElement
  tourContext={MyTourContext}
  id={MyTour.NAME}
  title={'Name Time!'}
  description={'We need this to make your account :)'}
>
  <Input placeholder="Name" />
</TourElement>
`}
      </CodeSnippet>

      <p>
        Then, whenever you'd like to start your tour, just import your context and
        dispatch the <code>START_TOUR</code> action.
      </p>
      <Alert type="warning">
        <strong>Note:</strong> The tour will not start until all of the steps are present
        in the DOM! The <JSXNode name="TourContextProvider" /> component you created
        earlier will be keeping track of this internally. You can check this with the
        <code>isRegistered</code> property of the context.
      </Alert>
      <br />
      <CodeSnippet language="tsx">
        {`function StartMyTourButton() {
  const {dispatch, isRegistered} = useMyTour();
  return (
    <Button
      onClick={() => dispatch({type: 'START_TOUR'})}
      disabled={!isRegistered}
    >
      Start Tour
    </Button>
  );
}`}
      </CodeSnippet>
      <br />
      <TourProvider>
        <TourElement
          tourContext={MyTourContext}
          id={MyTour.NAME}
          title={'Name Time!'}
          description={'This is the description of the name tour step.'}
        >
          <Input placeholder="Step 1: Name" />
        </TourElement>
        <TourElement
          tourContext={MyTourContext}
          id={MyTour.EMAIL}
          title={'Email Time!'}
          description={'This is the description of the email tour step.'}
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
          title={'Name Time!'}
          description={'This is the description of the name tour step.'}
          color="blue400"
        >
          <Input placeholder="Step 1: Name" />
        </CustomTourElement>
        <CustomTourElement
          tourContext={MyTourContext}
          id={MyTour.EMAIL}
          title={'Email Time!'}
          description={'This is the description of the email tour step.'}
          color="red400"
        >
          <Input placeholder="Step 2: Email" type="email" />
        </CustomTourElement>
        <CustomTourElement
          tourContext={MyTourContext}
          id={MyTour.PASSWORD}
          title={'Password Time!'}
          description={'This is the description of the password tour step.'}
          color="green400"
        >
          <Input placeholder="Step 3: Password" type="password" />
        </CustomTourElement>
      </TourProvider>
    </Fragment>
  ));
});

function StartTourButton() {
  const {dispatch, isRegistered} = useMyTour();
  return (
    <Button
      icon={<IconStar />}
      onClick={() => dispatch({type: 'START_TOUR'})}
      disabled={!isRegistered}
    >
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
    <SizingWindow>
      <BlurBoundary>
        <TourContextProvider
          isAvailable
          orderedStepIds={ORDERED_MY_TOUR}
          tourContext={MyTourContext}
          {...tourProviderProps}
        >
          <Flex gap={space(2)} align="center">
            <Flex gap={space(2)} justify="space-between" column align="flex-start">
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
    </SizingWindow>
  );
}

const BlurBoundary = styled('div')`
  position: relative;
  border: 1px dashed ${p => p.theme.purple400};
  padding: ${space(2)};
  margin: ${space(1)} ${space(2)};
`;

const Image = styled('img')`
  aspect-ratio: 1/1;
  height: 100%;
  object-fit: contain;
`;

const CustomTourElement = styled(TourElement<MyTour>)<{color: Color}>`
  &[aria-expanded='true']:after {
    box-shadow: 0 0 0 2px ${p => p.theme[p.color]};
  }
`;

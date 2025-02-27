import {createContext, Fragment, useContext} from 'react';
import styled from '@emotion/styled';

import compassImage from 'sentry-images/spot/onboarding-compass.svg';

import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {Input} from 'sentry/components/input';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {
  TourContextProvider,
  TourElement,
  type TourElementProps,
} from 'sentry/components/tours/components';
import type {TourContextType} from 'sentry/components/tours/tourContext';
import {IconStar} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

const enum MyTour {
  NAME = 'my-tour-name',
  EMAIL = 'my-tour-email',
  PASSWORD = 'my-tour-password',
}
const ORDERED_MY_TOUR = [MyTour.NAME, MyTour.EMAIL, MyTour.PASSWORD];
const MyTourContext = createContext<TourContextType<MyTour>>({
  currentStep: null,
  isAvailable: true,
  orderedStepIds: ORDERED_MY_TOUR,
  dispatch: () => {},
  registerStep: () => {},
});
function useMyTour(): TourContextType<MyTour> {
  return useContext(MyTourContext);
}
function MyTourElement(props: Omit<TourElementProps<MyTour>, 'tourContext'>) {
  const tourContext = useMyTour();
  return <TourElement tourContext={tourContext} {...props} />;
}

export default storyBook('Tours', story => {
  story('Usage', () => (
    <Fragment>
      <p>
        Tours are a way to guide users through a series of steps around a page in the
        product, with anchored tooltips which may jump all over the page.
      </p>
      <TourExample>
        <MyTourElement
          id={MyTour.NAME}
          title={'Name Time!'}
          description={'This is the description of the name tour step.'}
        >
          <Input placeholder="Step 1: Name" />
        </MyTourElement>
        <MyTourElement
          id={MyTour.EMAIL}
          title={'Email Time!'}
          description={'This is the description of the email tour step.'}
        >
          <Input placeholder="Step 2: Email" type="email" />
        </MyTourElement>
        rdddf
        <MyTourElement
          id={MyTour.PASSWORD}
          title={'Password Time!'}
          description={'This is the description of the password tour step.'}
        >
          <Input placeholder="Step 3: Password" type="password" />
        </MyTourElement>
      </TourExample>
    </Fragment>
  ));
});

const BlurBoundary = styled('div')`
  position: relative;
  border: 1px dashed ${p => p.theme.purple400};
  width: 100%;
  padding: ${space(2)};
  margin: ${space(1)} ${space(2)};
`;

const Image = styled('img')`
  aspect-ratio: 1/1;
  height: 100%;
  object-fit: contain;
`;

function StartTourButton() {
  const {dispatch} = useMyTour();
  return (
    <Button icon={<IconStar />} onClick={() => dispatch({type: 'START_TOUR'})}>
      Start Tour
    </Button>
  );
}

function TourExample({children}: {children: React.ReactNode}) {
  return (
    <SizingWindow>
      <BlurBoundary>
        <TourContextProvider
          isAvailable
          orderedStepIds={ORDERED_MY_TOUR}
          tourContext={MyTourContext}
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

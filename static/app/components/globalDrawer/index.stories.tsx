import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import storyBook from 'sentry/stories/storyBook';

import JSXNode from '../stories/jsxNode';

export default storyBook('GlobalDrawer', story => {
  story('Getting Started', () => (
    <Fragment>
      <p>
        <JSXNode name="GlobalDrawer" /> is a way to show a slide-out drawer on the right
        side of the UI. It's an application-wide singleton component, which means that
        only one drawer can be open at any given time and its position is always the same.
        The drawer is opened and closed via React hooks.
      </p>
      <p>
        By default the drawer can be closed with an "Escape" key press, with an outside
        click, or on URL location change. This behavior can be changed by passing in
        options to <code>openDrawer</code>. More on this below.
      </p>
    </Fragment>
  ));

  story('Usage Details', () => (
    <Fragment>
      <p>
        A common way to open the drawer is imperatively via a UI action like a button
        click.
      </p>

      <CodeSnippet language="jsx">
        {`import useDrawer from 'sentry/components/globalDrawer';

function OverviewPage() {
  const {openDrawer, closeDrawer} = useDrawer();

  const handleClick = () => {
    openDrawer(() => <ModalContent />);
  }

  return <button onClick={handleClick}>See More</button>;
}

function ModalContent() {
  return <p>Hello!</p>;
}
`}
      </CodeSnippet>

      <p>Another way is to open the drawer based on the current URL.</p>

      <CodeSnippet language="jsx">
        {`import {useEffect} from 'react';
import useDrawer from 'sentry/components/globalDrawer';
import {useLocation} from 'sentry/utils/useLocation';

function OverviewPage() {
  const location = useLocation();
  const {openDrawer, isDrawerOpen} = useDrawer();

  useEffect(() => {
    if (!isDrawerOpen && location.query.drawer) {
      openDrawer(
        () => {
          return <ModalContent />;
        },
        {
          ariaLabel: 'Hello Modal',
        }
      );
    }
  }, [isDrawerOpen, location.query.drawer, openDrawer]);

  return <p>Hello</p>;
}

function ModalContent() {
  return <p>Ahoy there</p>;
}
          `}
      </CodeSnippet>
    </Fragment>
  ));

  story('Empty Example', () => {
    const {openDrawer, closeDrawer} = useDrawer();
    return (
      <Fragment>
        <CodeSnippet language="jsx">
          {`<Button onClick={() => openDrawer(() => null, {ariaLabel: 'test drawer'})}>
  Open Drawer
</Button>`}
        </CodeSnippet>
        <LeftButton onClick={() => openDrawer(() => null, {ariaLabel: 'test drawer'})}>
          Open Drawer
        </LeftButton>
        <CodeSnippet language="jsx">
          {`<Button onClick={closeDrawer}>Close Drawer</Button>`}
        </CodeSnippet>
        <LeftButton onClick={closeDrawer}>Close Drawer</LeftButton>
      </Fragment>
    );
  });

  story('openDrawer() Options Example', () => {
    const {openDrawer} = useDrawer();
    return (
      <Fragment>
        <CodeSnippet language="jsx">
          {`<Button onClick={() => openDrawer(() => null, {
  ariaLabel: 'test drawer',
  closeOnEscapeKeypress: false, // defaults to true
  closeOnOutsideClick: false, // defaults to true
  shouldCloseOnLocationChange: (newLocation) => !newLocation.pathname.includes('tags'),
})}>
  Open Drawer
</Button>`}
        </CodeSnippet>
        <LeftButton
          onClick={() =>
            openDrawer(() => null, {
              ariaLabel: 'test drawer',
              closeOnEscapeKeypress: false,
            })
          }
        >
          No Escape Key
        </LeftButton>
        <LeftButton
          onClick={() =>
            openDrawer(() => null, {
              ariaLabel: 'test drawer',
              closeOnOutsideClick: false,
            })
          }
        >
          No Outside Click
        </LeftButton>
        <LeftButton
          onClick={() =>
            openDrawer(() => null, {
              ariaLabel: 'test drawer',
              closeOnEscapeKeypress: false,
              closeOnOutsideClick: false,
            })
          }
        >
          Neither, must click Close Button
        </LeftButton>
      </Fragment>
    );
  });

  story('Helper Components Example', () => {
    const {openDrawer} = useDrawer();
    return (
      <Fragment>
        <CodeSnippet language="jsx">
          {`import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';

<Button onClick={() => openDrawer(
  () => (
    <Fragment>
      <DrawerHeader>My Drawer</DrawerHeader>
      <DrawerBody>Lorem, ipsum...</DrawerBody>
    </Fragment>
  ),
  {ariaLabel: 'test drawer', onClose: () => alert('Called my handler!')}
)}>
  Open Drawer
</Button>`}
        </CodeSnippet>
        <LeftButton
          onClick={() =>
            openDrawer(
              () => (
                <Fragment>
                  <DrawerHeader>My Drawer</DrawerHeader>
                  <DrawerBody>
                    Lorem, ipsum dolor sit amet consectetur adipisicing elit. Temporibus
                    cupiditate voluptates nostrum voluptatibus ab provident eius accusamus
                    corporis, nesciunt possimus consectetur sapiente velit alias cum nemo
                    beatae doloribus sed accusantium?
                  </DrawerBody>
                </Fragment>
              ),
              // eslint-disable-next-line no-alert
              {ariaLabel: 'test drawer', onClose: () => alert('Called my handler!')}
            )
          }
        >
          Open Drawer
        </LeftButton>
      </Fragment>
    );
  });
});

const LeftButton = styled(Button)`
  margin: 12px 0;
  display: block;
`;

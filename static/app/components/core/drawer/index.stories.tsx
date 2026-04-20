import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {useDrawer} from '@sentry/scraps/drawer';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';

import * as Storybook from 'sentry/stories';

export default Storybook.story('GlobalDrawer', story => {
  story('Getting Started', () => (
    <Fragment>
      <p>
        <Storybook.JSXNode name="GlobalDrawer" /> is a way to show a slide-out drawer on
        the right side of the UI. It's an application-wide singleton component, which
        means that only one drawer can be open at any given time and its position is
        always the same. The drawer is opened and closed via React hooks. The contents of
        the drawer are unstyled.
      </p>
      <p>
        By default (<code>mode: 'blocking'</code>), the drawer can be closed with an
        "Escape" key press, with an outside click, or on URL location change. Use{' '}
        <code>mode: 'passive'</code> to opt out of scroll locking, outside-click close,
        and location-change close — useful for drawers that coexist with page interaction.
      </p>
    </Fragment>
  ));

  story('Example', () => {
    const {openDrawer, isDrawerOpen} = useDrawer();

    const showDetails = () => {
      if (!isDrawerOpen) {
        openDrawer(() => <MyDrawer title="Hello!" />, {ariaLabel: 'Details'});
      }
    };

    return (
      <Fragment>
        <CodeBlock language="jsx">
          {`import { useDrawer } from '@sentry/scraps/drawer';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';

function MyPage() {
  const {openDrawer, isDrawerOpen} = useDrawer();

  const showDetails = () => {
    if (!isDrawerOpen) {
      openDrawer(() => <MyDrawer title="Hello!" />, {ariaLabel: 'Details'});
    }
  };

  return (
    <div>
      <button onClick={showDetails}>Open Drawer</button>
    </div>
  );
}

function MyDrawer({title}: {title: string}) {
  return (
    <div>
      <DrawerHeader>{title}</DrawerHeader>
      <DrawerBody>Lorem, ipsum...</DrawerBody>
    </div>
  );
}
`}
        </CodeBlock>
        <div>
          <LeftButton onClick={showDetails}>Open Drawer</LeftButton>
        </div>

        <Alert.Container>
          <Alert variant="warning">
            Calling <code>openDrawer</code> updates a global context. All components that
            subscribe to that context will be re-rendered, and this can cause infinite
            rendering loops. Avoid calling <code>openDrawer</code> repeatedly. This can
            happen inside a <code>useEffect</code>, in a loop, in a callback, or other
            situations. Check <code>isDrawerOpen</code> before opening the drawer (see
            example above), wrap <code>openDrawer</code> in a <code>useCallback</code>{' '}
            with stable dependencies, or otherwise make sure not to repeatedly call{' '}
            <code>openDrawer</code>.
          </Alert>
        </Alert.Container>
      </Fragment>
    );
  });

  story('Closing The Drawer', () => {
    const {openDrawer, closeDrawer} = useDrawer();
    return (
      <Fragment>
        <p>There are several ways to control when the drawer is closed.</p>
        <p>
          One way is to provide UI that manually closes it, by using{' '}
          <code>closeDrawer</code>. The close button can be inside or outside the drawer.
        </p>

        <CodeBlock language="jsx">
          {`function MyPage() {
  const {openDrawer, closeDrawer} = useDrawer();

  const showDetails = () => {
    openDrawer(() => <p>Details</p>, {ariaLabel: "Details"});
  }

  const closeDetails = () => {
    closeDrawer();
  }

  return <button onClick={closeDetails} />;
}`}
        </CodeBlock>

        <LeftButton
          onClick={() =>
            openDrawer(
              () => <LeftButton onClick={closeDrawer}>Close Drawer</LeftButton>,
              {
                ariaLabel: 'test drawer',
                mode: 'passive',
              }
            )
          }
        >
          Open Drawer
        </LeftButton>
        <LeftButton onClick={closeDrawer}>Close Drawer</LeftButton>

        <p>
          Another is clicking outside the drawer. By default (
          <code>mode: 'blocking'</code>
          ), clicking outside the drawer closes it. Use <code>mode: 'passive'</code> to
          disable this behavior. For finer control in blocking mode, use{' '}
          <code>shouldCloseOnInteractOutside</code> — a function that receives the
          interacted element and returns <code>false</code> to prevent closing.
        </p>

        <CodeBlock language="jsx">
          {`// Disable click-outside close and scroll locking:
openDrawer(() => null, {
  ariaLabel: 'My Drawer',
  mode: 'passive',
})

// Fine-grained control in blocking mode (don't close when clicking links):
openDrawer(() => null, {
  ariaLabel: 'My Drawer',
  shouldCloseOnInteractOutside: (element) => element.tagName !== 'A',
})`}
        </CodeBlock>

        <LeftButton
          onClick={() =>
            openDrawer(() => <DrawerHeader>My Drawer</DrawerHeader>, {
              ariaLabel: 'test drawer',
              mode: 'passive',
            })
          }
        >
          Open Drawer (passive — does not close on click outside)
        </LeftButton>

        <p>
          Another is URL change. By default (<code>mode: 'blocking'</code>), the drawer
          automatically closes if the URL changes. In <code>mode: 'passive'</code>, the
          drawer stays open on URL changes. You can override this default in either mode
          with the <code>shouldCloseOnLocationChange</code> prop — a function that accepts
          the new <code>Location</code> object and returns whether the drawer should
          close.
        </p>

        <LeftButton
          onClick={() =>
            openDrawer(() => <DrawerHeader>My Drawer</DrawerHeader>, {
              ariaLabel: 'test drawer',
              shouldCloseOnLocationChange: () => false,
            })
          }
        >
          Open Drawer. Does not close on URL change.
        </LeftButton>

        <p>
          Finally, "Escape" key press. The drawer always closes on Escape in both modes.
        </p>
      </Fragment>
    );
  });

  story('Automatically Opening Drawer on URLs', () => (
    <Fragment>
      <p>
        It's good practice to represent the drawer state in the URL. If a page opens a
        details drawer, that should update the URL. Opening that URL should open the
        drawer. The simplest way to do this is via <code>useEffect</code> and checking the
        URL.
      </p>

      <CodeBlock language="jsx">
        {`import {useEffect} from 'react';
import { useDrawer } from '@sentry/scraps/drawer';
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
      </CodeBlock>

      <p>
        You don't need to worry about closing the drawer, since it'll close automatically
        on URL change. If the drawer contents rely on the URL and change it, you'll need
        to specify <code>shouldCloseOnLocationChange</code> to prevent the drawer from
        closing (or re-triggering) unnecessarily.
      </p>
    </Fragment>
  ));

  story('Helper Components', () => {
    const {openDrawer} = useDrawer();
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="DrawerHeader" /> and{' '}
          <Storybook.JSXNode name="DrawerBody" /> are helper components. You can use them
          to make your drawers look consistent with the rest of the application.{' '}
          <Storybook.JSXNode name="DrawerHeader" /> includes a "Close" button and a spot
          to render a title. <Storybook.JSXNode name="DrawerBody" /> specifies correct
          padding, scrolling, and overflow.
        </p>

        <CodeBlock language="jsx">
          {`import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';

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
        </CodeBlock>
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

function MyDrawer({title}: {title: string}) {
  return (
    <div>
      <DrawerHeader>{title}</DrawerHeader>
      <DrawerBody>Lorem, ipsum...</DrawerBody>
    </div>
  );
}

const LeftButton = styled(Button)`
  margin: 12px 0;
  display: block;
`;

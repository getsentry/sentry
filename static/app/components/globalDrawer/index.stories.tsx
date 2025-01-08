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
        The drawer is opened and closed via React hooks. The contents of the drawer are
        unstyled.
      </p>
      <p>
        By default the drawer can be closed with an "Escape" key press, with an outside
        click, or on URL location change. This behavior can be changed by passing in
        options to <code>openDrawer</code>. More on this below.
      </p>
    </Fragment>
  ));

  story('Example', () => {
    const {openDrawer, closeDrawer} = useDrawer();
    return (
      <Fragment>
        <CodeSnippet language="jsx">
          {`<Button onClick={() => openDrawer(() => <h1>Hello</h1>, {ariaLabel: 'test drawer'})}>
  Open Drawer
</Button>

<Button onClick={closeDrawer}>Close Drawer</Button>
`}
        </CodeSnippet>
        <LeftButton
          onClick={() => openDrawer(() => <h1>Hello!</h1>, {ariaLabel: 'test drawer'})}
        >
          Open Drawer
        </LeftButton>
        <LeftButton onClick={closeDrawer}>Close Drawer</LeftButton>
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

        <CodeSnippet language="jsx">
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
        </CodeSnippet>

        <LeftButton
          onClick={() =>
            openDrawer(() => null, {
              ariaLabel: 'test drawer',
              closeOnOutsideClick: false,
            })
          }
        >
          Open Drawer
        </LeftButton>
        <LeftButton onClick={closeDrawer}>Close Drawer</LeftButton>

        <p>
          Another is clicking outside the drawer . You can control this behavior with the{' '}
          <code>closeOnOutsideClick</code> and <code>shouldCloseOnInteractOutside</code>{' '}
          props. <code>closeOnOutsideClick</code> is a boolean. If <code>true</code>,
          clicking anywhere outside the drawer will close it.{' '}
          <code>shouldCloseOnInteractOutside</code> is a function that accepts the element
          that was interacted with. Returning <code>false</code> will prevent the drawer
          close.
        </p>

        <CodeSnippet language="jsx">
          {`<Button onClick={() => openDrawer(() => null, {
    ariaLabel: 'My Drawer',
    closeOnOutsideClick: true, // or false
    shouldCloseOnInteractOutside: (element) => element.tagName !== 'A';
})}>
  Open Drawer
</Button>`}
        </CodeSnippet>

        <LeftButton
          onClick={() =>
            openDrawer(() => <DrawerHeader>My Drawer</DrawerHeader>, {
              ariaLabel: 'test drawer',
              closeOnOutsideClick: false,
            })
          }
        >
          Open Drawer. Does not close on click outside.
        </LeftButton>

        <p>
          Another is URL change. By default, the drawer will automatically close if the
          URL changes. This applies to the pathname, query, and hash. You can control this
          with the <code>shouldCloseOnLocationChange</code> prop.{' '}
          <code>shouldCloseOnLocationChange</code> is a function that accepts the new{' '}
          <code>Location</code> object. Based on its contents you can decide whether the
          drawer should close or stay open.
        </p>

        <LeftButton
          onClick={() =>
            openDrawer(() => <DrawerHeader>My Drawer</DrawerHeader>, {
              ariaLabel: 'test drawer',
              closeOnEscapeKeypress: false,
              closeOnOutsideClick: false,
            })
          }
        >
          Open Drawer. Does not close on URL change.
        </LeftButton>

        <p>
          Finally, "Escape" key press. You can control this with the{' '}
          <code>closeOnEscapeKeypress</code> prop.
        </p>

        <LeftButton
          onClick={() =>
            openDrawer(() => <DrawerHeader>My Drawer</DrawerHeader>, {
              ariaLabel: 'test drawer',
              closeOnOutsideClick: false,
            })
          }
        >
          Open Drawer. Does not close on "Escape".
        </LeftButton>
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
          <JSXNode name="DrawerHeader" /> and <JSXNode name="DrawerBody" /> are helper
          components. You can use them to make your drawers look consistent with the rest
          of the application. <JSXNode name="DrawerHeader" /> includes a "Close" button
          and a spot to render a title. <JSXNode name="DrawerBody" /> specifies correct
          padding, scrolling, and overflow.
        </p>

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

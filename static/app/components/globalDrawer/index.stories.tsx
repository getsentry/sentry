import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import useDrawer from 'sentry/components/globalDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import storyBook from 'sentry/stories/storyBook';

export default storyBook('GlobalDrawer', story => {
  story('Usage', () => (
    <Fragment>
      <CodeSnippet language="js">
        {`import useDrawer from 'sentry/components/globalDrawer';\nconst {openDrawer, closeDrawer} = useDrawer();`}
      </CodeSnippet>
      <p>
        By default the drawer can be closed with an 'escape' press, or an outside click.
        It also closes by default on location change. This behavior can be changed by
        passing in options to <code>openDrawer</code>.
      </p>
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

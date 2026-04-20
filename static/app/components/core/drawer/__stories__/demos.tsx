/**
 * Demo components for drawer.mdx documentation.
 *
 * Extracted into a .tsx file because prettier's MDX parser flattens JSX
 * indentation inside exported functions when JSX is passed as a function
 * argument (e.g. openDrawer(() => <Component />, {...})).
 */

import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {Flex} from '@sentry/scraps/layout';

// ──────────────────────────────────────────────
// drawer.mdx demos
// ──────────────────────────────────────────────

export function BasicDemo() {
  const {openDrawer, isDrawerOpen} = useDrawer();
  return (
    <Button
      onClick={() => {
        if (!isDrawerOpen) {
          openDrawer(() => <MyDrawer title="Hello!" />, {ariaLabel: 'Details'});
        }
      }}
    >
      Open Drawer
    </Button>
  );
}

function MyDrawer({title}: {title: string}) {
  return (
    <div>
      <DrawerHeader>{title}</DrawerHeader>
      <DrawerBody>Lorem, ipsum dolor sit amet consectetur adipisicing elit.</DrawerBody>
    </div>
  );
}

export function ClosingDemo() {
  const {openDrawer, closeDrawer} = useDrawer();
  return (
    <Flex gap="sm">
      <Button
        onClick={() =>
          openDrawer(() => <Button onClick={closeDrawer}>Close Drawer</Button>, {
            ariaLabel: 'test drawer',
            mode: 'passive',
          })
        }
      >
        Open Drawer
      </Button>
      <Button onClick={closeDrawer}>Close Drawer</Button>
    </Flex>
  );
}

export function ShouldCloseDemo() {
  const {openDrawer} = useDrawer();
  return (
    <Button
      onClick={() =>
        openDrawer(() => <DrawerHeader>My Drawer</DrawerHeader>, {
          ariaLabel: 'test drawer',
          shouldCloseOnLocationChange: () => false,
        })
      }
    >
      Open Drawer (does not close on URL change)
    </Button>
  );
}

export function HelperComponentsDemo() {
  const {openDrawer} = useDrawer();
  return (
    <Button
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
    </Button>
  );
}

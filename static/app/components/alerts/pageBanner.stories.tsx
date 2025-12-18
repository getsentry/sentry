import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import replaysDeadRageBackground from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import PageBanner from 'sentry/components/alerts/pageBanner';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {ExternalLink} from 'sentry/components/core/link';
import {IconBroadcast} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

export default Storybook.story('PageBanner', story => {
  const storiesButton = (
    <LinkButton
      external
      href="https://sentry.io/orgredirect/organizations/:orgslug/stories"
      priority="primary"
    >
      View Stories
    </LinkButton>
  );

  story('Example', () => (
    <Fragment>
      <p>Here's an example Banner announcing this UI Component Library:</p>
      <PageBanner
        button={storiesButton}
        description="Build new products faster by exploring reusable the UI components available inside Sentry."
        heading="Introducing the UI Component Library"
        icon={<IconBroadcast size="sm" />}
        image={replaysDeadRageBackground}
        title="UI Library Available"
      />
    </Fragment>
  ));

  story('Example with dismiss', () => {
    const [isDismissed, setIsDismissed] = useState(false);

    return (
      <Fragment>
        <p>
          This example renders an X in the top-right corner. You can wire it up with
          something like <kbd>useDismissAlert()</kbd>.
        </p>
        <p>
          Is Dismissed? <var>{String(isDismissed)}</var>
        </p>
        {isDismissed ? (
          <Button size="sm" onClick={() => setIsDismissed(false)}>
            Show banner
          </Button>
        ) : (
          <PageBanner
            button={storiesButton}
            description="Build new products faster by exploring reusable the UI components available inside Sentry."
            heading="Introducing the UI Component Library"
            icon={<IconBroadcast size="sm" />}
            image={replaysDeadRageBackground}
            title="UI Library Available"
            onDismiss={() => setIsDismissed(true)}
          />
        )}
      </Fragment>
    );
  });

  story('Resizable', () => {
    const [flexGrow, setFlexGrow] = useState(false);
    return (
      <Fragment>
        <p>
          The banner will resize if it's shrunk really narrow. To make it expand inside a
          flex parent set <kbd>flex-grow:1</kbd>.
        </p>
        <p>
          <Button size="sm" onClick={() => setFlexGrow(!flexGrow)}>
            flexGrow: <var>{flexGrow ? 1 : 0}</var>
          </Button>
        </p>
        <Storybook.SizingWindow>
          <PageBanner
            style={{flexGrow: flexGrow ? 1 : 0}}
            button={storiesButton}
            description="Build new products faster by exploring reusable the UI components available inside Sentry."
            heading="Introducing the UI Component Library"
            icon={<IconBroadcast size="sm" />}
            image={replaysDeadRageBackground}
            title="UI Library Available"
          />
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('More variations', () => (
    <Fragment>
      <p>There are some examples where we change out the colors and mix things up:</p>
      <PageBanner
        button={storiesButton}
        description={
          <Fragment>
            Build new products faster by exploring reusable the UI components available
            inside Sentry.{' '}
            <ExternalLink href="https://sentry.io/orgredirect/organizations/:orgslug/stories">
              See stories
            </ExternalLink>
          </Fragment>
        }
        heading="Introducing the UI Component Library"
        icon={<IconBroadcast size="sm" />}
        image={replaysDeadRageBackground}
        title={
          <Fragment>
            UI Library Available at <Green>https://sentry.io/stories</Green>
          </Fragment>
        }
      />
    </Fragment>
  ));
});

const Green = styled('span')`
  color: ${p => p.theme.colors.green500};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

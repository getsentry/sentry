import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import replaysDeadRageBackground from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import {Button, LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import PageBanner from 'sentry/components/replays/pageBanner';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import {IconBroadcast} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import storyBook from 'sentry/stories/storyBook';

export default storyBook(PageBanner, story => {
  const storiesButton = (
    <LinkButton
      external
      href="https://sentry.io/orgredirect/organizations/:orgslug/stories"
      priority="primary"
    >
      {t('View Stories')}
    </LinkButton>
  );

  story('Example', () => (
    <Fragment>
      <p>Here's an example Banner announcing this UI Component Library:</p>
      <PageBanner
        button={storiesButton}
        description={t(
          'Build new products faster by exploring reusable the UI components available inside Sentry.'
        )}
        heading={t('Introducing the UI Component Library')}
        icon={<IconBroadcast size="sm" />}
        image={replaysDeadRageBackground}
        title={t('UI Library Available')}
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
            {t('Show banner')}
          </Button>
        ) : (
          <PageBanner
            button={storiesButton}
            description={t(
              'Build new products faster by exploring reusable the UI components available inside Sentry.'
            )}
            heading={t('Introducing the UI Component Library')}
            icon={<IconBroadcast size="sm" />}
            image={replaysDeadRageBackground}
            title={t('UI Library Available')}
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
            {tct('flexGrow: [flexGlow]', {flexGrow: <var>{flexGrow ? 1 : 0}</var>})}
          </Button>
        </p>
        <SizingWindow>
          <PageBanner
            style={{flexGrow: flexGrow ? 1 : 0}}
            button={storiesButton}
            description={t(
              'Build new products faster by exploring reusable the UI components available inside Sentry.'
            )}
            heading={t('Introducing the UI Component Library')}
            icon={<IconBroadcast size="sm" />}
            image={replaysDeadRageBackground}
            title={t('UI Library Available')}
          />
        </SizingWindow>
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
            {tct(
              'Build new products faster by exploring reusable the UI components available inside Sentry. [link]',
              {
                link: (
                  <ExternalLink href="https://sentry.io/orgredirect/organizations/:orgslug/stories">
                    {t('See stories.')}
                  </ExternalLink>
                ),
              }
            )}
          </Fragment>
        }
        heading={t('Introducing the UI Component Library')}
        icon={<IconBroadcast size="sm" />}
        image={replaysDeadRageBackground}
        title={tct('UI Library Available at [green]', {
          green: <Green>https://sentry.io/stories</Green>,
        })}
      />
    </Fragment>
  ));
});

const Green = styled('span')`
  color: ${p => p.theme.green400};
  font-weight: bold;
`;

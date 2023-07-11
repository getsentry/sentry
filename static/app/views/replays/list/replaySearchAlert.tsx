import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import {ModalRenderProps, openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {ReplayNewFeatureBanner} from 'sentry/components/replays/replayNewFeatureBanner';
import {IconBroadcast} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';

const REPLAY_CLICK_SEARCH_FEATURE_BANNER_KEY = 'new-feature-banner-replays-click-search';
interface Props {
  needSdkUpdates: boolean;
}

export function ReplaySearchAlert({needSdkUpdates}: Props) {
  const location = useLocation();
  const {dismiss, isDismissed} = useDismissAlert({
    key: REPLAY_CLICK_SEARCH_FEATURE_BANNER_KEY,
  });

  if (isDismissed) {
    return null;
  }
  const heading = (
    <Fragment>
      {tct('Introducing [feature]', {
        feature: (
          <ExternalLink href="https://blog.sentry.io/introducing-search-by-user-click-for-session-replay-zero-in-on-interesting/">
            {t('Click Search')}
          </ExternalLink>
        ),
      })}
    </Fragment>
  );

  const description = (
    <span>
      {tct(
        `Find replays which captured specific DOM elements using our new search key [key]`,
        {
          key: <strong>{t("'click'")}</strong>,
        }
      )}
    </span>
  );

  const handleTryNow = () => {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        query: 'click.tag:button',
      },
    });
    dismiss();
  };

  const handleLearnMore = () => {
    openModal(LearnMoreModal);
  };

  if (isDismissed) {
    return null;
  }

  if (needSdkUpdates) {
    return (
      <ReplayNewFeatureBanner
        heading={heading}
        description={description}
        button={
          <Button priority="primary" onClick={handleLearnMore}>
            {t('Learn More')}
          </Button>
        }
      />
    );
  }

  return (
    <ReplayNewFeatureBanner
      heading={heading}
      description={description}
      button={
        <Button priority="primary" onClick={handleTryNow}>
          {t('Try Now')}
        </Button>
      }
    />
  );
}

function LearnMoreModal({Header, Body, Footer, closeModal}: ModalRenderProps) {
  return (
    <Fragment>
      <Header>
        <ModalHeaderContainer>
          <IconBroadcast />
          <h2>{t('Click Search')}</h2>
        </ModalHeaderContainer>
      </Header>
      <Body>
        <p>
          {t(
            'Search by user click is a new feature which allows you to search for replays by DOM element - or in other words - where users have clicked to interact with specific parts of your web app.'
          )}
        </p>
        <strong>{t('Prerequisites')}</strong>
        <ul>
          <li>{t('JavaScript SDK Version is >= 7.44.0')}</li>
        </ul>
      </Body>
      <Footer>
        <Button priority="primary" onClick={closeModal}>
          {t('Got it')}
        </Button>
      </Footer>
    </Fragment>
  );
}

const ModalHeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

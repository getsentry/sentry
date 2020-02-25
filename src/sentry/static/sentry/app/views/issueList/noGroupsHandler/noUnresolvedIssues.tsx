import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';

const Message = () => (
  <React.Fragment>
    <EmptyMessage>
      {t("We couldn't find any issues that matched your filters.")}
    </EmptyMessage>
    <p>{t('Get out there and write some broken code!')}</p>
  </React.Fragment>
);

const CongratsRobotsVideo = React.lazy(() =>
  import(/* webpackChunkName: "CongratsRobotsVideo" */ './congratsRobots')
);

/**
 * Error boundary for loading the robots video.
 * This can error because of the file size of the video
 *
 * Silently ignore the error, this isn't really important enough to
 * capture in Sentry
 */
class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  {hasError: boolean}
> {
  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  state = {
    hasError: false,
  };

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

/**
 * Note, video needs `muted` for `autoplay` to work on Chrome
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/video
 */
const NoUnresolvedIssues = () => (
  <Wrapper>
    <ErrorBoundary>
      <React.Suspense fallback={null}>
        <CongratsRobotsVideo />
      </React.Suspense>
    </ErrorBoundary>
    <Message />
  </Wrapper>
);

const Wrapper = styled('div')`
  display: flex;
  padding: ${space(4)} ${space(4)};
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: ${p => p.theme.gray3};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const EmptyMessage = styled('div')`
  font-weight: 600;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    font-size: ${p => p.theme.fontSizeExtraLarge};
  }
`;

export default NoUnresolvedIssues;

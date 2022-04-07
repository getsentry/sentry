import * as React from 'react';
import styled from '@emotion/styled';

import congratsRobotsPlaceholder from 'sentry-images/spot/congrats-robots-placeholder.jpg';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

const Placeholder = () => (
  <PlaceholderImage
    alt={t('Congrats, you have no unresolved issues')}
    src={congratsRobotsPlaceholder}
  />
);

const Message = ({
  title,
  subtitle,
}: {
  subtitle: React.ReactNode;
  title: React.ReactNode;
}) => (
  <React.Fragment>
    <EmptyMessage>{title}</EmptyMessage>
    <p>{subtitle}</p>
  </React.Fragment>
);

const CongratsRobotsVideo = React.lazy(() => import('./congratsRobots'));

type State = {hasError: boolean};

/**
 * Error boundary for loading the robots video.
 * This can error because of the file size of the video
 *
 * Silently ignore the error, this isn't really important enough to
 * capture in Sentry
 */
class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
  static getDerivedStateFromError(): State {
    return {
      hasError: true,
    };
  }

  state: State = {
    hasError: false,
  };

  render() {
    if (this.state.hasError) {
      return <Placeholder />;
    }

    return this.props.children;
  }
}

const NoUnresolvedIssues = ({
  title,
  subtitle,
}: {
  subtitle: React.ReactNode;
  title: React.ReactNode;
}) => (
  <Wrapper>
    <ErrorBoundary>
      <React.Suspense fallback={<Placeholder />}>
        <CongratsRobotsVideo />
      </React.Suspense>
    </ErrorBoundary>
    <Message title={title} subtitle={subtitle} />
  </Wrapper>
);

const Wrapper = styled('div')`
  display: flex;
  padding: ${space(4)} ${space(4)};
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: ${p => p.theme.subText};

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

const PlaceholderImage = styled('img')`
  max-height: 320px; /* This should be same height as video in CongratsRobots */
`;

export default NoUnresolvedIssues;

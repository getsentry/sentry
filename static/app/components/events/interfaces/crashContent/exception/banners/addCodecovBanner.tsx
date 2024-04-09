import styled from '@emotion/styled';

import addCoverage from 'sentry-images/spot/add-coverage.svg';

import {LinkButton} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

import {
  CloseBannerButton,
  IntegationBannerDescription,
  IntegationBannerTitle,
  StacktraceIntegrationBannerWrapper,
} from './addIntegrationBanner';

interface AddCodecovBannerProps {
  onClick: () => void;
  onDismiss: () => void;
  orgSlug: string;
}

export function AddCodecovBanner({onDismiss, onClick, orgSlug}: AddCodecovBannerProps) {
  return (
    <StacktraceIntegrationBannerWrapper>
      <div>
        <IntegationBannerTitle>
          {t('View Test Coverage with CodeCov')}
        </IntegationBannerTitle>
        <IntegationBannerDescription>
          {t(
            'Enable CodeCov to get quick, line-by-line test coverage information in stack traces.'
          )}
        </IntegationBannerDescription>
        <LinkButton to={`/settings/${orgSlug}/organization/`} size="sm" onClick={onClick}>
          {t('Enable in Settings')}
        </LinkButton>
      </div>
      <CoverageBannerImage src={addCoverage} />
      <CloseBannerButton
        borderless
        priority="link"
        aria-label={t('Dismiss')}
        icon={<IconClose color="subText" />}
        size="xs"
        onClick={onDismiss}
      />
    </StacktraceIntegrationBannerWrapper>
  );
}

const CoverageBannerImage = styled('img')`
  position: absolute;
  display: block;
  bottom: 6px;
  right: 4rem;
  pointer-events: none;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

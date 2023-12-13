import styled from '@emotion/styled';

import {SectionHeading} from 'sentry/components/charts/styles';
import FeatureBadge from 'sentry/components/featureBadge';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {space} from 'sentry/styles/space';

type MetaDataProps = {
  bodyText: React.ReactNode;
  headingText: string;
  subtext: React.ReactNode;
  badge?: 'alpha' | 'beta' | 'new';
  tooltipText?: string;
};

export function MetaData({
  headingText,
  tooltipText,
  bodyText,
  subtext,
  badge,
}: MetaDataProps) {
  return (
    <HeaderInfo>
      <StyledSectionHeading>
        {headingText}
        {tooltipText && (
          <QuestionTooltip
            position="top"
            size="xs"
            containerDisplayMode="block"
            title={tooltipText}
          />
        )}
        {badge && <StyledFeatureBadge type={badge} />}
      </StyledSectionHeading>
      <SectionBody>{bodyText}</SectionBody>
      <SectionSubtext>{subtext}</SectionSubtext>
    </HeaderInfo>
  );
}

const HeaderInfo = styled('div')`
  min-height: 78px;
  white-space: nowrap;
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin: 0;
`;

const SectionBody = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: ${space(0.5)} 0;
  max-height: 32px;
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin: 0;
`;

export const SectionSubtext = styled('div')<{type?: 'error' | 'default'}>`
  color: ${p => (p.type === 'error' ? p.theme.error : p.theme.subText)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

import * as React from 'react';
import styled from '@emotion/styled';

import {SectionHeading} from 'app/components/charts/styles';
import FeatureBadge from 'app/components/featureBadge';
import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';

type MetaDataProps = {
  headingText: string;
  tooltipText: string;
  bodyText: React.ReactNode;
  subtext: React.ReactNode;
  badge?: 'alpha' | 'beta' | 'new';
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
        <QuestionTooltip
          position="top"
          size="sm"
          containerDisplayMode="block"
          title={tooltipText}
        />
        {badge && <StyledFeatureBadge type={badge} />}
      </StyledSectionHeading>
      <SectionBody>{bodyText}</SectionBody>
      <SectionSubtext>{subtext}</SectionSubtext>
    </HeaderInfo>
  );
}

const HeaderInfo = styled('div')`
  height: 78px;
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

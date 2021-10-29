import {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {SectionHeading as _SectionHeading} from 'app/components/charts/styles';
import {Panel} from 'app/components/panels';
import {IconArrow} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

export const Actions = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  grid-template-columns: 1fr min-content;
  align-items: center;
`;

export const UpperPanel = styled(Panel)`
  padding: ${space(1.5)} ${space(3)};
  margin-top: ${space(3)};
  margin-bottom: 0;
  border-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;

  display: grid;

  grid-template-columns: 1fr;
  grid-gap: ${space(1.5)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: auto repeat(3, max-content);
    grid-gap: 48px;
  }
`;

export const LowerPanel = styled('div')`
  > div {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
`;

type HeaderItemProps = {
  label: string;
  value: ReactNode;
  align: 'left' | 'right';
  isSortKey?: boolean;
};

export function HeaderItem(props: HeaderItemProps) {
  const {label, value, align, isSortKey} = props;
  const theme = useTheme();

  return (
    <HeaderItemContainer align={align}>
      {isSortKey && (
        <IconArrow
          data-test-id="span-sort-arrow"
          size="xs"
          color={theme.subText as any}
          direction="down"
        />
      )}
      <SectionHeading>{label}</SectionHeading>
      <SectionValue>{value}</SectionValue>
    </HeaderItemContainer>
  );
}

export const HeaderItemContainer = styled('div')<{align: 'left' | 'right'}>`
  ${overflowEllipsis};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    text-align: ${p => p.align};
  }
`;

const SectionHeading = styled(_SectionHeading)`
  margin: 0px 0px 0px ${space(0.5)};
`;

const SectionValue = styled('h1')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: normal;
  line-height: 1.2;
  color: ${p => p.theme.textColor};
  margin-bottom: 0;
`;

export const SpanLabelContainer = styled('div')`
  ${overflowEllipsis};
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

export const emptyValue = <EmptyValueContainer>{t('n/a')}</EmptyValueContainer>;

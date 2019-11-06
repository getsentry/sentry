import React from 'react';

import styled from 'react-emotion';
import space from 'app/styles/space';
import Link from 'app/components/links/link';

// import {t} from 'app/locale';
// import InlineSvg from 'app/components/inlineSvg';

type Props = {
  title?: string;
  queryDetail?: string;
  to?: string | object;
  onEventClick?: () => void;
};

class QueryCard extends React.Component<Props> {
  render() {
    const {title, queryDetail, onEventClick, to} = this.props;

    return (
      <StyledQueryCard onClick={onEventClick} to={to}>
        <QueryCardHeader>
          <StyledTitle>{title}</StyledTitle>
          <StyledQueryDetail>{queryDetail}</StyledQueryDetail>
        </QueryCardHeader>
        <QueryCardFooter>TBD</QueryCardFooter>
      </StyledQueryCard>
    );
  }
}

const StyledQueryCard = styled(Link)`
  background: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 200px;
`;

const QueryCardHeader = styled('div')`
  display: block;
  padding: ${space(1.5)} ${space(2)};
`;

const StyledTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray5};
  font-weight: 300;
`;

const StyledQueryDetail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray2};
  font-weight: 300;
`;

const QueryCardFooter = styled('div')`
  display: block;
  padding: ${space(1.5)} ${space(2)};
  color: ${p => p.theme.gray5};
`;

export default QueryCard;

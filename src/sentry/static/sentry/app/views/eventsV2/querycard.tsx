import React from 'react';

import styled from 'react-emotion';
// import theme from 'app/utils/theme';
// import space from 'app/styles/space';
// import {t} from 'app/locale';

import Link from 'app/components/links/link';

type Props = {
  title?: string;
  queryDetail?: string;
  creatorName?: object;
  to?: string | object;
  onEventClick?: () => void;
};

class QueryCard extends React.Component<Props> {
  render() {
    const {title, queryDetail, creatorName, onEventClick, to} = this.props;

    return (
      <StyledQueryCard onClick={onEventClick} to={to}>
        <QueryCardHeader>
          {title}
          {queryDetail}
        </QueryCardHeader>
        <QueryCardFooter>{creatorName}</QueryCardFooter>
      </StyledQueryCard>
    );
  }
}

const StyledQueryCard = styled(Link)`
  background: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  height: 200px;
`;

const QueryCardHeader = styled('div')`
  display: block;
`;

const QueryCardFooter = styled('div')`
  display: block;
`;

export default QueryCard;

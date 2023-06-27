import {PureComponent} from 'react';
import styled from '@emotion/styled';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import Card from 'sentry/components/card';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {User} from 'sentry/types';

type Props = {
  renderGraph: () => React.ReactNode;
  to: object;
  createdBy?: User | undefined;
  dateStatus?: React.ReactNode;
  onEventClick?: () => void;
  queryDetail?: string;
  renderContextMenu?: () => React.ReactNode;
  subtitle?: string;
  title?: string;
};

class QueryCard extends PureComponent<Props> {
  handleClick = () => {
    const {onEventClick} = this.props;
    onEventClick?.();
  };

  render() {
    const {
      title,
      subtitle,
      queryDetail,
      renderContextMenu,
      renderGraph,
      createdBy,
      dateStatus,
    } = this.props;

    return (
      <Link data-test-id={`card-${title}`} onClick={this.handleClick} to={this.props.to}>
        <StyledQueryCard interactive>
          <QueryCardHeader>
            <QueryCardContent>
              <QueryTitle>{title}</QueryTitle>
              <QueryDetail>{queryDetail}</QueryDetail>
            </QueryCardContent>
            <AvatarWrapper>
              {createdBy ? (
                <ActivityAvatar type="user" user={createdBy} size={34} />
              ) : (
                <ActivityAvatar type="system" size={34} />
              )}
            </AvatarWrapper>
          </QueryCardHeader>
          <QueryCardBody>
            <StyledErrorBoundary mini>{renderGraph()}</StyledErrorBoundary>
          </QueryCardBody>
          <QueryCardFooter>
            <DateSelected>
              {subtitle}
              {dateStatus ? (
                <DateStatus>
                  {t('Edited')} {dateStatus}
                </DateStatus>
              ) : null}
            </DateSelected>
            {renderContextMenu && renderContextMenu()}
          </QueryCardFooter>
        </StyledQueryCard>
      </Link>
    );
  }
}

const AvatarWrapper = styled('span')`
  border: 3px solid ${p => p.theme.border};
  border-radius: 50%;
  height: min-content;
`;

const QueryCardContent = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  margin-right: ${space(1)};
`;

const StyledQueryCard = styled(Card)`
  justify-content: space-between;
  height: 100%;
  &:focus,
  &:hover {
    top: -1px;
  }
`;

const QueryCardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const QueryTitle = styled('div')`
  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
  ${p => p.theme.overflowEllipsis};
  font-weight: initial;
`;

const QueryDetail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  line-height: 1.5;
  ${p => p.theme.overflowEllipsis};
`;

const QueryCardBody = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  max-height: 150px;
  height: 100%;
  overflow: hidden;
`;

const QueryCardFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const DateSelected = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-column-gap: ${space(1)};
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.textColor};
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.subText};
  padding-left: ${space(1)};
`;

const StyledErrorBoundary = styled(ErrorBoundary)`
  margin-bottom: 100px;
`;

export default QueryCard;

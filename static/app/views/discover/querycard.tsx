import {PureComponent} from 'react';
import styled from '@emotion/styled';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import Card from 'sentry/components/card';
import {Link} from 'sentry/components/core/link';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';

type Props = {
  renderGraph: () => React.ReactNode;
  to: Record<PropertyKey, unknown>;
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
            {renderContextMenu?.()}
          </QueryCardFooter>
        </StyledQueryCard>
      </Link>
    );
  }
}

const AvatarWrapper = styled('span')`
  border: 3px solid ${p => p.theme.tokens.border.primary};
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
  color: ${p => p.theme.tokens.content.primary};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  /* @TODO(jonasbadalic) This should be a title component and not a div */
  font-size: 1rem;
  line-height: 1.2;
  /* @TODO(jonasbadalic) font-weight: initial? */
  font-weight: initial;
`;

const QueryDetail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  line-height: 1.5;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  font-size: ${p => p.theme.fontSize.sm};
  grid-column-gap: ${space(1)};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${p => p.theme.tokens.content.primary};
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  padding-left: ${space(1)};
`;

const StyledErrorBoundary = styled(ErrorBoundary)`
  margin-bottom: 100px;
`;

export default QueryCard;

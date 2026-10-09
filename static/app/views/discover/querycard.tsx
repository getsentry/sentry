import {PureComponent} from 'react';
import styled from '@emotion/styled';

import {Flex, Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {Card} from 'sentry/components/card';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
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

export class QueryCard extends PureComponent<Props> {
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
          <Flex padding="lg xl">
            <Container flexGrow={1} marginRight="md" overflow="hidden">
              <QueryTitle>{title}</QueryTitle>
              <QueryDetail>{queryDetail}</QueryDetail>
            </Container>
            <AvatarWrapper>
              {createdBy ? (
                <ActivityAvatar type="user" user={createdBy} size={34} />
              ) : (
                <ActivityAvatar type="system" size={34} />
              )}
            </AvatarWrapper>
          </Flex>
          <Container
            background="secondary"
            height="100%"
            maxHeight="150px"
            overflow="hidden"
          >
            <StyledErrorBoundary mini>{renderGraph()}</StyledErrorBoundary>
          </Container>
          <Flex justify="between" align="center" padding="md xl">
            <DateSelected>
              {subtitle}
              {dateStatus ? (
                <DateStatus>
                  {t('Edited')} {dateStatus}
                </DateStatus>
              ) : null}
            </DateSelected>
            {renderContextMenu?.()}
          </Flex>
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

const StyledQueryCard = styled(Card)`
  justify-content: space-between;
  height: 100%;
  &:focus,
  &:hover {
    top: -1px;
  }
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
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  line-height: 1.5;
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DateSelected = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  grid-column-gap: ${p => p.theme.space.md};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${p => p.theme.tokens.content.primary};
`;

const DateStatus = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  padding-left: ${p => p.theme.space.md};
`;

const StyledErrorBoundary = styled(ErrorBoundary)`
  margin-bottom: 100px;
`;

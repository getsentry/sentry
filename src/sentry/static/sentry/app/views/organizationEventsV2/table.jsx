import React from 'react';
import PropTypes from 'prop-types';
import styled, {css} from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LoadingContainer from 'app/components/loading/loadingContainer';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {SPECIAL_FIELDS} from './data';
import {QueryLink} from './styles';
import SortLink from './sortLink';

export default class Table extends React.Component {
  static propTypes = {
    view: SentryTypes.EventView.isRequired,
    data: PropTypes.arrayOf(PropTypes.object),
    isLoading: PropTypes.bool.isRequired,
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object,
  };

  renderBody() {
    const {view, data, organization, location, isLoading} = this.props;
    const {fields} = view.data;

    if (!data || isLoading) {
      return null;
    }

    if (data.length === 0) {
      return (
        <EmptyStateWarning>
          <p>{t('No results found')}</p>
        </EmptyStateWarning>
      );
    }

    return data.map((row, idx) => (
      <Row key={idx} className={getGridStyle(view)}>
        {fields.map(field => {
          const target = {
            pathname: `/organizations/${organization.slug}/events/`,
            query: {
              ...location.query,
              query: `${field}:${row[field]}`,
            },
          };

          return (
            <Cell key={field}>
              {SPECIAL_FIELDS.hasOwnProperty(field) ? (
                SPECIAL_FIELDS[field].renderFunc(row, {organization, location})
              ) : (
                <QueryLink to={target}>{row[field]}</QueryLink>
              )}
            </Cell>
          );
        })}
      </Row>
    ));
  }

  render() {
    const {isLoading, location, view} = this.props;
    const {fields} = view.data;

    return (
      <Panel>
        <TableHeader className={getGridStyle(view)}>
          {fields.map(field => {
            let title = field;
            let sortKey = field;
            if (SPECIAL_FIELDS.hasOwnProperty(field)) {
              title = SPECIAL_FIELDS[field].title || field;
              sortKey = SPECIAL_FIELDS[field].sortField;
            }

            if (sortKey === false) {
              return <HeaderItem key={field}>{title}</HeaderItem>;
            }

            return (
              <HeaderItem key={field}>
                <SortLink sortKey={sortKey} title={title} location={location} />
              </HeaderItem>
            );
          })}
        </TableHeader>
        <StyledPanelBody isLoading={isLoading}>
          <LoadingContainer isLoading={isLoading}>{this.renderBody()}</LoadingContainer>
        </StyledPanelBody>
      </Panel>
    );
  }
}

function getGridStyle(view) {
  const cols = Array.isArray(view.columnWidths)
    ? view.columnWidths.join(' ')
    : `3fr repeat(${view.data.fields.length - 1}, 1fr)`;

  return css`
    display: grid;
    grid-template-columns: ${cols};
    grid-gap: ${space(1)};
  `;
}

const TableHeader = styled(PanelHeader)`
  padding: ${space(2)} ${space(1)};
`;

const HeaderItem = styled('div')`
  padding: 0 ${space(1)};
`;

const Row = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)};
`;

const Cell = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const StyledPanelBody = styled(({isLoading, ...props}) => <PanelBody {...props} />)`
  ${p => p.isLoading && 'min-height: 240px;'};
`;

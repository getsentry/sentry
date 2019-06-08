import React from 'react';
import PropTypes from 'prop-types';
import styled, {css} from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';
import space from 'app/styles/space';

import {SPECIAL_FIELDS} from './data';
import {QueryLink} from './styles';
import LoadingContainer from './loadingContainer';

export default class Table extends React.Component {
  static propTypes = {
    view: SentryTypes.EventView.isRequired,
    data: PropTypes.arrayOf(PropTypes.object),
    isLoading: PropTypes.bool,
    organization: SentryTypes.Organization.isRequired,
    onSearch: PropTypes.func.isRequired,
    location: PropTypes.object,
  };

  renderBody() {
    const {view, data, organization, onSearch, location} = this.props;
    const {fields} = view.data;

    if (!data) {
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
      <Row key={idx} className={getGridStyle(fields.length)}>
        {fields.map(field => (
          <Cell key={field}>
            {SPECIAL_FIELDS.hasOwnProperty(field) ? (
              SPECIAL_FIELDS[field].renderFunc(row, {organization, onSearch, location})
            ) : (
              <QueryLink onClick={() => onSearch(`${field}:${row[field]}`)}>
                {row[field]}
              </QueryLink>
            )}
          </Cell>
        ))}
      </Row>
    ));
  }

  render() {
    const {isLoading, view, data} = this.props;
    const {fields} = view.data;

    const hasResults = !!(data && data.length);

    return (
      <Panel>
        <TableHeader className={getGridStyle(fields.length)}>
          {fields.map(field => (
            <HeaderItem key={field}>
              {SPECIAL_FIELDS.hasOwnProperty(field)
                ? SPECIAL_FIELDS[field].title || field
                : field}
            </HeaderItem>
          ))}
        </TableHeader>
        <PanelBody style={{position: 'relative'}}>
          <LoadingContainer isLoading={isLoading} hasResults={hasResults}>
            {this.renderBody()}
          </LoadingContainer>
        </PanelBody>
      </Panel>
    );
  }
}

function getGridStyle(colCount) {
  return css`
    display: grid;
    grid-template-columns: 3fr repeat(${colCount - 1}, 1fr);
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
